import React, { useState, useEffect } from 'react';
import {
  ShoppingCart, Plus, Search, Truck, Wallet, CalendarClock, 
  ClipboardList, PackageCheck, FileInput, RotateCcw, 
  Banknote, BadgeDollarSign, Filter, Download
} from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Import New Sub-Views
import { ProveedoresView } from './compras/ProveedoresView';
import { GastosView } from './compras/GastosView';
import { GastosRecurrentesView } from './compras/GastosRecurrentesView';
import { OrdenesCompraView } from './compras/OrdenesCompraView';
import { RecepcionesCompraView } from './compras/RecepcionesCompraView';
import { FacturasProveedorView } from './compras/FacturasProveedorView';
import { FacturasProveedorRecView } from './compras/FacturasProveedorRecView';
import { PagosRealizadosView } from './compras/PagosRealizadosView';
import { CreditosProveedorView } from './compras/CreditosProveedorView';

interface ComprasPageProps {
  activeSubModule?: string;
}

const subModuleTabMap: Record<string, string> = {
  'proveedores': 'proveedores',
  'gastos': 'gastos',
  'gastos-recurrentes': 'gastos-rec',
  'ordenes-compra': 'ordenes',
  'recepciones-compra': 'recepciones',
  'facturas-proveedor': 'facturas-prov',
  'facturas-proveedor-rec': 'facturas-prov-rec',
  'pagos-realizados': 'pagos',
  'creditos-proveedor': 'creditos',
};

export function ComprasPage({ activeSubModule }: ComprasPageProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(() => 
    activeSubModule ? (subModuleTabMap[activeSubModule] || 'proveedores') : 'proveedores'
  );

  useEffect(() => {
    if (activeSubModule) {
      setActiveTab(subModuleTabMap[activeSubModule] || 'proveedores');
    }
  }, [activeSubModule]);

  return (
    <div className="space-y-6 p-4 md:p-6 pb-20 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between bg-card/40 backdrop-blur-xl p-6 rounded-3xl border border-border/50 shadow-2xl shadow-primary/5">
        <div className="flex items-center gap-5">
          <div className="p-4 bg-gradient-to-br from-[#05602b] to-[#044c22] rounded-2xl shadow-lg shadow-[#05602b]/20 rotate-3 group-hover:rotate-0 transition-transform duration-500">
            <ShoppingCart className="size-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground bg-clip-text">
              Módulo de Compras
            </h1>
            <p className="text-sm text-muted-foreground font-medium flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#05602b] animate-pulse" />
              Gestión inteligente de gastos, proveedores y abastecimiento
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Buscar en compras..." 
              className="pl-10 w-64 bg-background/50 border-border/50 focus:ring-primary/20 transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" className="gap-2 border-border/50 bg-background/50 hover:bg-muted/50 transition-all font-bold uppercase text-[10px] tracking-widest h-10 px-4">
            <Download className="size-4" /> Exportar
          </Button>
          <Button className="gap-2 bg-[#05602b] hover:bg-[#044c22] text-white shadow-xl shadow-[#05602b]/20 font-bold uppercase text-[10px] tracking-widest h-10 px-5">
            <Plus className="size-4" /> Nuevo Registro
          </Button>
        </div>
      </div>

      {/* Main Tabs System */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md p-2 rounded-2xl border border-border/50 shadow-sm overflow-x-auto scrollbar-hide mb-8">
          <TabsList className="bg-transparent h-auto p-0 flex gap-1 items-center justify-start lg:justify-between min-w-max">
            <TabsTrigger value="proveedores" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <Truck className="mr-2 size-4" /> Proveedores
            </TabsTrigger>
            <TabsTrigger value="gastos" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <Wallet className="mr-2 size-4" /> Gastos
            </TabsTrigger>
            <TabsTrigger value="gastos-rec" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <CalendarClock className="mr-2 size-4" /> Gastos Rec.
            </TabsTrigger>
            <TabsTrigger value="ordenes" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <ClipboardList className="mr-2 size-4" /> Ordenes
            </TabsTrigger>
            <TabsTrigger value="recepciones" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <PackageCheck className="mr-2 size-4" /> Recepciones
            </TabsTrigger>
            <TabsTrigger value="facturas-prov" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <FileInput className="mr-2 size-4" /> Facturas Prod.
            </TabsTrigger>
            <TabsTrigger value="facturas-prov-rec" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <RotateCcw className="mr-2 size-4" /> Fact. Rec.
            </TabsTrigger>
            <TabsTrigger value="pagos" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <Banknote className="mr-2 size-4" /> Pagos
            </TabsTrigger>
            <TabsTrigger value="creditos" className="data-[state=active]:bg-[#05602b]/10 data-[state=active]:text-[#05602b] px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all">
              <BadgeDollarSign className="mr-2 size-4" /> Creditos
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Dynamic Content Area */}
        <div className="relative min-h-[600px]">
          <TabsContent value="proveedores" className="mt-0 focus-visible:ring-0">
            <ProveedoresView />
          </TabsContent>
          
          <TabsContent value="gastos" className="mt-0 focus-visible:ring-0">
            <GastosView />
          </TabsContent>

          <TabsContent value="gastos-rec" className="mt-0 focus-visible:ring-0">
            <GastosRecurrentesView />
          </TabsContent>

          <TabsContent value="ordenes" className="mt-0 focus-visible:ring-0">
            <OrdenesCompraView />
          </TabsContent>

          <TabsContent value="recepciones" className="mt-0 focus-visible:ring-0">
            <RecepcionesCompraView />
          </TabsContent>

          <TabsContent value="facturas-prov" className="mt-0 focus-visible:ring-0">
            <FacturasProveedorView />
          </TabsContent>

          <TabsContent value="facturas-prov-rec" className="mt-0 focus-visible:ring-0">
            <FacturasProveedorRecView />
          </TabsContent>

          <TabsContent value="pagos" className="mt-0 focus-visible:ring-0">
            <PagosRealizadosView />
          </TabsContent>

          <TabsContent value="creditos" className="mt-0 focus-visible:ring-0">
            <CreditosProveedorView />
          </TabsContent>
        </div>
      </Tabs>

      {/* Footer / Tip */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-6 py-3 bg-card/90 backdrop-blur-2xl border border-border/50 rounded-full shadow-2xl z-50 animate-in slide-in-from-bottom-5 duration-700 delay-500">
        <div className="flex -space-x-2">
          {[1,2,3].map(i => (
            <div key={i} className={`size-6 rounded-full border-2 border-background bg-gradient-to-br from-[#05602b] to-[#044c22] ${i === 2 ? 'opacity-60' : i === 3 ? 'opacity-30' : ''}`} />
          ))}
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#05602b]">
          Intelligente • Premium • Scalable
        </p>
      </div>
    </div>
  );
}
