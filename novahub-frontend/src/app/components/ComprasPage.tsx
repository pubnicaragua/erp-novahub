import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Truck, Wallet, CalendarClock,
  ClipboardList, PackageCheck, FileInput, RotateCcw,
  Banknote, BadgeDollarSign, ChevronRight
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './ui/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  suppliersService, expensesService, recurringExpensesService,
  purchaseOrdersService, purchaseReceiptsService,
  supplierInvoicesService, recurringSupplierInvoicesService,
  paymentsMadeService, supplierCreditsService,
} from '../services/compras.service';
import type {
  Supplier, Expense, RecurringExpense, PurchaseOrder,
  PurchaseReceipt, SupplierInvoice, RecurringSupplierInvoice,
  PaymentMade, SupplierCredit,
} from '../types';

import { ProveedoresView }         from './compras/ProveedoresView';
import { GastosView }              from './compras/GastosView';
import { GastosRecurrentesView }   from './compras/GastosRecurrentesView';
import { OrdenesCompraView }       from './compras/OrdenesCompraView';
import { RecepcionesCompraView }   from './compras/RecepcionesCompraView';
import { FacturasProveedorView }   from './compras/FacturasProveedorView';
import { FacturasProveedorRecView } from './compras/FacturasProveedorRecView';
import { PagosRealizadosView }     from './compras/PagosRealizadosView';
import { CreditosProveedorView }   from './compras/CreditosProveedorView';

const COMPRAS_SECTIONS = [
  { id: 'proveedores',    label: 'Proveedores',           icon: Truck,          description: 'Directorio de proveedores' },
  { id: 'gastos',        label: 'Gastos',                icon: Wallet,         description: 'Registro de gastos' },
  { id: 'gastos-rec',    label: 'Gastos Recurrentes',    icon: CalendarClock,  description: 'Gastos fijos periódicos' },
  { id: 'ordenes',       label: 'Orden de Compra',       icon: ClipboardList,  description: 'Pedidos a proveedores' },
  { id: 'recepciones',   label: 'Recepciones',           icon: PackageCheck,   description: 'Entrada de mercancía' },
  { id: 'facturas-prov', label: 'Facturas Proveedor',    icon: FileInput,      description: 'Cuentas por pagar' },
  { id: 'facturas-rec',  label: 'Facturas Recurrentes',  icon: RotateCcw,      description: 'Contratos periódicos' },
  { id: 'pagos',         label: 'Pagos Realizados',      icon: Banknote,       description: 'Histórico de pagos' },
  { id: 'creditos',      label: 'Créditos Proveedor',   icon: BadgeDollarSign, description: 'Notas de crédito recibidas' },
];

interface ComprasPageProps {
  activeSubModule?: string;
}

type ComprasData = {
  proveedores:   Supplier[];
  gastos:        Expense[];
  gastosRec:     RecurringExpense[];
  ordenes:       PurchaseOrder[];
  recepciones:   PurchaseReceipt[];
  facturasProv:  SupplierInvoice[];
  facturasRec:   RecurringSupplierInvoice[];
  pagos:         PaymentMade[];
  creditos:      SupplierCredit[];
};

export function ComprasPage({ activeSubModule }: ComprasPageProps) {
  const normalize = (s?: string) => {
    if (!s) return 'proveedores';
    const map: Record<string, string> = {
      'proveedores': 'proveedores',
      'gastos': 'gastos',
      'gastos-recurrentes': 'gastos-rec',
      'ordenes-compra': 'ordenes',
      'recepciones-compra': 'recepciones',
      'facturas-proveedor': 'facturas-prov',
      'facturas-proveedor-rec': 'facturas-rec',
      'pagos-realizados': 'pagos',
      'creditos-proveedor': 'creditos',
    };
    return map[s] || s;
  };

  const [activeSection, setActiveSection] = useState(normalize(activeSubModule));
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ComprasData>({
    proveedores: [], gastos: [], gastosRec: [], ordenes: [],
    recepciones: [], facturasProv: [], facturasRec: [], pagos: [], creditos: [],
  });

  useEffect(() => {
    if (activeSubModule) setActiveSection(normalize(activeSubModule));
  }, [activeSubModule]);

  useEffect(() => { fetchData(); }, [activeSection]);

  const toArr = (r: any) => Array.isArray(r) ? r : (r?.data || []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sup, exp, expRec, ord, rec, inv, invRec, pay, cred] = await Promise.all([
        suppliersService.getAll().catch(() => []),
        expensesService.getAll().catch(() => []),
        recurringExpensesService.getAll().catch(() => []),
        purchaseOrdersService.getAll().catch(() => []),
        purchaseReceiptsService.getAll().catch(() => []),
        supplierInvoicesService.getAll().catch(() => []),
        recurringSupplierInvoicesService.getAll().catch(() => []),
        paymentsMadeService.getAll().catch(() => []),
        supplierCreditsService.getAll().catch(() => []),
      ]);
      setData({
        proveedores:  toArr(sup),
        gastos:       toArr(exp),
        gastosRec:    toArr(expRec),
        ordenes:      toArr(ord),
        recepciones:  toArr(rec),
        facturasProv: toArr(inv),
        facturasRec:  toArr(invRec),
        pagos:        toArr(pay),
        creditos:     toArr(cred),
      });
    } catch (e) {
      toast.error('Error al cargar módulo de Compras');
    } finally {
      setLoading(false);
    }
  };

  const current = COMPRAS_SECTIONS.find(s => s.id === activeSection) || COMPRAS_SECTIONS[0];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <main className="flex-1 overflow-y-auto custom-scrollbar relative">
        {/* Sticky Header */}
        <header className="sticky top-0 z-20 w-full h-20 bg-background/80 backdrop-blur-md border-b border-border/50 flex items-center justify-between px-6 md:px-10">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-muted-foreground/40 text-[10px] font-black uppercase tracking-widest mb-1">
              <span>Abastecimiento</span>
              <ChevronRight className="size-3" />
              <span className="text-primary/60">{current.label}</span>
            </div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tighter">{current.label}</h2>
          </div>
          <Button
            onClick={fetchData}
            variant="ghost"
            size="icon"
            className="size-10 rounded-full hover:bg-primary/10 transition-colors"
            disabled={loading}
          >
            <RotateCcw className={cn('size-5 text-muted-foreground', loading && 'animate-spin')} />
          </Button>
        </header>

        {/* Section Nav Pills (horizontal scroll) */}
        <div className="sticky top-20 z-10 bg-background/90 backdrop-blur-md border-b border-border/30 px-6 md:px-10 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1 min-w-max">
            {COMPRAS_SECTIONS.map(s => {
              const Icon = s.icon;
              const active = s.id === activeSection;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                    active
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                  )}
                >
                  <Icon className="size-3" />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 md:p-10 max-w-[1700px] mx-auto min-h-[calc(100vh-8rem)]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeSection === 'proveedores'  && <ProveedoresView    data={data.proveedores}  loading={loading} onRefresh={fetchData} />}
              {activeSection === 'gastos'        && <GastosView          data={data.gastos}        loading={loading} onRefresh={fetchData} />}
              {activeSection === 'gastos-rec'    && <GastosRecurrentesView data={data.gastosRec}  loading={loading} onRefresh={fetchData} />}
              {activeSection === 'ordenes'       && <OrdenesCompraView   data={data.ordenes}       loading={loading} onRefresh={fetchData} />}
              {activeSection === 'recepciones'   && <RecepcionesCompraView data={data.recepciones} loading={loading} onRefresh={fetchData} />}
              {activeSection === 'facturas-prov' && <FacturasProveedorView  data={data.facturasProv} loading={loading} onRefresh={fetchData} />}
              {activeSection === 'facturas-rec'  && <FacturasProveedorRecView data={data.facturasRec} loading={loading} onRefresh={fetchData} />}
              {activeSection === 'pagos'         && <PagosRealizadosView  data={data.pagos}         loading={loading} onRefresh={fetchData} />}
              {activeSection === 'creditos'      && <CreditosProveedorView data={data.creditos}     loading={loading} onRefresh={fetchData} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
