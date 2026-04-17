import React, { useState, useEffect } from 'react';
import { 
  FileText, CreditCard, Receipt, ShoppingCart, 
  Download, History, TrendingUp, AlertCircle, Calendar,
  RefreshCw, CornerUpLeft, StickyNote, Mail, Phone, MapPin, Truck, Wallet, Box
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription 
} from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';
import { 
  purchaseOrdersService, supplierInvoicesService, 
  purchaseReceiptsService, vendorCreditsService,
  paymentsService
} from '../../services/compras.service';
import { useCurrency } from '../../contexts/CurrencyContext';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import type { Supplier } from '../../types';
import { generateSupplierStatementPDF, translateStatus } from '../../utils/pdfGenerator';

interface SupplierHistoryModalProps {
  supplier: Supplier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierHistoryModal({ supplier, open, onOpenChange }: SupplierHistoryModalProps) {
  const { formatConvertedAmount, displayCurrency, convertAmount } = useCurrency();
  const { user } = useAuth();
  const { themeConfig } = useTheme();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (open && supplier) {
      fetchHistory();
    }
  }, [open, supplier]);

  const fetchHistory = async () => {
    if (!supplier) return;
    setLoading(true);
    try {
      const toArr = (res: any) => Array.isArray(res) ? res : (res?.data || []);
      const filters = { pageSize: 1000 }; 

      const [
        ordersRes, invoicesRes, receptionsRes, creditsRes, paymentsRes
      ] = await Promise.all([
        purchaseOrdersService.getAll(filters),
        supplierInvoicesService.getAll(filters),
        purchaseReceiptsService.getAll(filters),
        vendorCreditsService.getAll(filters),
        paymentsService.getAll(filters)
      ]);

      const matchSupplier = (item: any) => 
        item.supplierId === supplier.id || 
        item.supplier?.id === supplier.id ||
        (item.supplier?.code && item.supplier.code === supplier.code);

      const orders = toArr(ordersRes).filter(matchSupplier);
      const invoices = toArr(invoicesRes).filter(matchSupplier);
      const receptions = toArr(receptionsRes).filter(matchSupplier);
      const credits = toArr(creditsRes).filter(matchSupplier);
      const payments = toArr(paymentsRes).filter(matchSupplier);

      const all: any[] = [
        ...orders.map(x => ({ ...x, type: 'ORDER', label: 'Orden Compra', color: 'text-violet-500', bg: 'bg-violet-500/10', icon: ShoppingCart })),
        ...invoices.map(x => ({ ...x, type: 'INVOICE', label: 'Factura Prov.', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: FileText })),
        ...receptions.map(x => ({ ...x, type: 'RECEPTION', label: 'Recepción', color: 'text-indigo-500', bg: 'bg-indigo-500/10', icon: Box, total: 0 })),
        ...credits.map(x => ({ ...x, type: 'CREDIT', label: 'Crédito Prov.', color: 'text-orange-500', bg: 'bg-orange-500/10', icon: StickyNote })),
        ...payments.map(x => ({ ...x, type: 'PAYMENT', label: 'Pago Realizado', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: CreditCard, total: x.amount }))
      ];

      all.sort((a, b) => {
        const timeA = new Date(a.createdAt || a.date).getTime();
        const timeB = new Date(b.createdAt || b.date).getTime();
        return timeB - timeA;
      });
      setTransactions(all);
    } catch (error) {
      console.error('Error fetching supplier history:', error);
      toast.error('Error al sincronizar transacciones');
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!supplier) return;
    try {
      await generateSupplierStatementPDF({
        supplier,
        transactions,
        tenantName: user?.tenantName || 'Empresa',
        tenantLogo: themeConfig?.logo,
        formatAmount: formatConvertedAmount,
        primaryColor: themeConfig?.colors.primary
      });
      toast.success('Estado de cuenta exportado');
    } catch (error) {
      toast.error('Error al generar PDF');
    }
  };

  if (!supplier) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 flex flex-col h-[90vh] max-h-[900px] overflow-hidden bg-background border-border shadow-2xl">
        {/* Header Section */}
        <DialogHeader className="p-6 md:p-8 bg-card border-b shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-5 text-left">
              <div className="size-16 rounded-3xl bg-primary/10 flex items-center justify-center font-black text-primary text-2xl border border-primary/20 shadow-sm">
                {supplier.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">{supplier.name}</DialogTitle>
                <div className="flex flex-wrap items-center gap-3 mt-1.5">
                  <Badge variant="outline" className="text-[10px] font-black uppercase tracking-widest bg-primary/5 text-primary border-primary/20">
                    {supplier.code}
                  </Badge>
                  <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                    <Mail className="size-3" /> {supplier.email || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <Button 
              onClick={handleExportPDF}
              className="rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[11px] tracking-widest px-6 h-12 shadow-xl shadow-primary/20 border border-primary/20"
              disabled={loading}
            >
              <Download className="size-4 mr-2" /> Exportar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Content Area */}
        <ScrollArea className="flex-1 min-h-0 overflow-auto bg-slate-50/30 dark:bg-transparent">
          <div className="p-6 md:p-8 space-y-8">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden group hover:border-rose-500/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center shadow-inner">
                      <TrendingUp className="size-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Saldo Pendiente</p>
                      <p className="text-2xl font-black text-rose-500 tabular-nums tracking-tighter leading-none">
                        {formatConvertedAmount(supplier.balance || 0, 'NIO')}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-border/50 shadow-sm bg-card overflow-hidden group hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                      <Wallet className="size-6" />
                    </div>
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-1">Compras Totales</p>
                      <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter leading-none">
                        {formatConvertedAmount(transactions.reduce((acc, t) => {
                          const isPurchase = ['INVOICE', 'ORDER'].includes(t.type);
                          return acc + (isPurchase ? convertAmount(t.total, t.currency, t.exchangeRate) : 0);
                        }, 0), displayCurrency)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-card p-8 rounded-3xl shadow-sm border border-border/50 relative overflow-hidden">
              <div className="space-y-5">
                <div className="relative z-10">
                  <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/50 mb-1.5 flex items-center gap-2">
                    <UserPlus className="size-3" /> Contacto Principal
                  </p>
                  <p className="font-bold text-sm text-foreground">{supplier.contactName || 'No asignado'}</p>
                </div>
              </div>
              <div className="space-y-5">
                <div className="relative z-10">
                  <p className="font-black uppercase tracking-widest text-[10px] text-muted-foreground/50 mb-1.5 flex items-center gap-2">
                    <Phone className="size-3" /> Teléfono Directo
                  </p>
                  <p className="font-bold text-sm text-foreground tabular-nums">{supplier.phone || 'No registrado'}</p>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 size-40 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
            </div>

            {/* Transaction History Timeline */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <h4 className="text-[13px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-3">
                  <History className="size-4 text-primary" /> Historial de Movimientos
                </h4>
                {loading && (
                  <div className="flex items-center gap-2 uppercase font-black text-[9px] text-primary tracking-widest">
                    Sincronizando... <div className="size-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {transactions.map((it, idx) => (
                  <div 
                    key={idx} 
                    className="group relative flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-card hover:bg-slate-50 dark:hover:bg-slate-900/40 border border-border/50 rounded-3xl transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                  >
                    <div className="flex items-center gap-4 sm:gap-5 text-left">
                      <div className={cn(
                        "size-10 sm:size-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-sm shrink-0", 
                        it.bg, it.color
                      )}>
                        <it.icon className="size-5 sm:size-6" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm sm:text-[15px] font-black text-foreground tracking-tight truncate max-w-[120px] xs:max-w-none">{it.number}</span>
                          <span className={cn(
                            "text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full whitespace-nowrap",
                            it.bg, it.color
                          )}>
                            {it.label}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          <span className="text-[11px] font-bold text-muted-foreground/70 flex items-center gap-1.5 whitespace-nowrap">
                            <Calendar className="size-3.5" /> {new Date(it.date).toLocaleDateString()}
                          </span>
                          <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground/30 flex items-center gap-1 whitespace-nowrap">
                            • {translateStatus(it.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right sm:text-right border-t sm:border-none pt-3 sm:pt-0 mt-1 sm:mt-0 flex justify-between sm:block items-center">
                      <p className="sm:hidden text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Monto</p>
                      <p className={cn(
                        "text-[16px] sm:text-[18px] font-black tabular-nums tracking-tighter", 
                        (it.type === 'INVOICE' || (it.type === 'PAYMENT' && it.reference?.startsWith('SC-'))) 
                          ? 'text-rose-500' 
                          : (it.type === 'PAYMENT' || it.type === 'CREDIT')
                            ? 'text-emerald-500'
                            : 'text-muted-foreground/50'
                      )}>
                        {/* 
                          Facturas / Liquidación Crédito: (+)
                          Pagos / Crédito Emitido: (-)
                          Órdenes / Recepciones / Recurrentes: (Sin Signo)
                        */}
                        {
                          (it.type === 'INVOICE' || (it.type === 'PAYMENT' && it.reference?.startsWith('SC-'))) 
                          ? '+' 
                          : (it.type === 'PAYMENT' || it.type === 'CREDIT')
                            ? '-'
                            : ''
                        }
                        {formatConvertedAmount(it.total, it.currency, it.exchangeRate)}
                      </p>
                    </div>
                  </div>
                ))}

                {!loading && transactions.length === 0 && (
                  <div className="text-center py-20 bg-card/50 rounded-[40px] border border-dashed border-border/60">
                    <History className="size-10 text-muted-foreground/20 mx-auto mb-4" />
                    <p className="text-sm font-bold text-muted-foreground/40 italic">No se encontraron transacciones en el registro histórico de este proveedor.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function UserPlus(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </svg>
  );
}
