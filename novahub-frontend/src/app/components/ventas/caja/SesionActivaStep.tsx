import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { Badge } from '../../ui/badge';
import { Calculator, ArrowDownToLine, ArrowUpFromLine, Plus, Printer, Lock, Vault, BarChart3 } from 'lucide-react';
import { CashRegisterSession, SessionLog, CashRegisterCount, CashClosureMode } from '../../../services/caja.service';
import { MovimientoManualModal } from './MovimientoManualModal';
import { DenominationCounter, NIO_BILLS, NIO_COINS, USD_BILLS, USD_COINS, DenominationState } from './DenominationCounter';
import { toast } from 'sonner';
import { useCurrency } from '../../../contexts/CurrencyContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { generateSessionSummaryPDF } from '../../../utils/pdfGenerator';
import { formatSalesAmount } from '../../../utils/salesPriceList';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";

interface SesionActivaStepProps {
  session: CashRegisterSession;
  logs: SessionLog[];
  closureMode: CashClosureMode;
  countAttempts: CashRegisterCount[];
  expectedNIO: number;
  expectedUSD: number;
  onAddMovement: (dto: any) => Promise<void>;
  onSubmitCount: (dto: any) => Promise<any>;
  onConfirmClose: (dto: any) => Promise<void>;
  onNavigateToFacturacion?: () => void;
}

export function SesionActivaStep({ 
  session, 
  logs, 
  closureMode,
  countAttempts,
  expectedNIO, 
  expectedUSD, 
  onAddMovement, 
  onSubmitCount,
  onConfirmClose,
  onNavigateToFacturacion 
}: SesionActivaStepProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isCloseAlertOpen, setIsCloseAlertOpen] = useState(false);
  const [isRecounting, setIsRecounting] = useState(false);
  const [nioDenominations, setNioDenominations] = useState<DenominationState[]>([
    ...NIO_BILLS.map(v => ({ value: v, quantity: 0, type: 'bill' as const })),
    ...NIO_COINS.map(v => ({ value: v, quantity: 0, type: 'coin' as const }))
  ]);
  const [usdDenominations, setUsdDenominations] = useState<DenominationState[]>([
    ...USD_BILLS.map(v => ({ value: v, quantity: 0, type: 'bill' as const })),
    ...USD_COINS.map(v => ({ value: v, quantity: 0, type: 'coin' as const }))
  ]);

  const renderLogIcon = (type: string, method?: string) => {
    switch(type) {
      case 'SALE': return <Badge className="bg-emerald-500/10 text-emerald-500 border-none px-2 rounded-sm text-[10px]">VENTA</Badge>;
      case 'ENTRY': return <Badge className="bg-blue-500/10 text-blue-500 border-none px-2 rounded-sm text-[10px]">ENTRADA</Badge>;
      case 'EXIT': return <Badge className="bg-destructive/10 text-destructive border-none px-2 rounded-sm text-[10px]">GASTO</Badge>;
      case 'OPEN': return <Badge className="bg-zinc-500/10 text-zinc-400 border-none px-2 rounded-sm text-[10px]">APERTURA</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{type}</Badge>;
    }
  };

  const { displayCurrency, exchangeRate: globalRate } = useCurrency();
  const sessionRate = session.exchangeRateUSD || globalRate;
  const isUSD = displayCurrency === 'USD';
  const symbol = isUSD ? '$' : 'C$';

  const calcTotalNIO = () => nioDenominations.reduce((acc, d) => acc + (d.value * d.quantity), 0);
  const calcTotalUSD = () => usdDenominations.reduce((acc, d) => acc + (d.value * d.quantity), 0);
  
  const contadoNIO = calcTotalNIO();
  const contadoUSD = calcTotalUSD();

  const totalContadoConverted = isUSD 
    ? (contadoUSD + (contadoNIO / sessionRate))
    : (contadoNIO + (contadoUSD * sessionRate));

  const totalExpectedConverted = isUSD
    ? (expectedUSD + (expectedNIO / sessionRate))
    : (expectedNIO + (expectedUSD * sessionRate));

  const diferencia = totalContadoConverted - totalExpectedConverted;
  const isBlind = closureMode === 'BLIND';
  const hasSubmittedBlindCount = isBlind && countAttempts.length > 0;
  const canRecount = isBlind && countAttempts.length === 1 && !isRecounting;
  const latestCount = countAttempts[countAttempts.length - 1] || null;
  const showSystemAmounts = !isBlind || hasSubmittedBlindCount;

  useEffect(() => {
    const latestDenominations = latestCount?.denominations || [];
    if (latestDenominations.length === 0) return;

    setNioDenominations(current => current.map(denomination => ({
      ...denomination,
      quantity: Number(latestDenominations.find(d => d.currency === 'NIO' && Number(d.value) === denomination.value)?.quantity || 0),
    })));
    setUsdDenominations(current => current.map(denomination => ({
      ...denomination,
      quantity: Number(latestDenominations.find(d => d.currency === 'USD' && Number(d.value) === denomination.value)?.quantity || 0),
    })));
  }, [latestCount?.attempt]);

  const buildDenominations = () => [
    ...nioDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'NIO', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity })),
    ...usdDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'USD', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity }))
  ];

  const resetDenominations = () => {
    setNioDenominations(NIO_BILLS.concat(NIO_COINS).map((value, index) => ({
      value,
      quantity: 0,
      type: index < NIO_BILLS.length ? 'bill' as const : 'coin' as const,
    })));
    setUsdDenominations(USD_BILLS.concat(USD_COINS).map((value, index) => ({
      value,
      quantity: 0,
      type: index < USD_BILLS.length ? 'bill' as const : 'coin' as const,
    })));
  };

  const submitBlindCount = async () => {
    try {
      await onSubmitCount({
        denominations: buildDenominations(),
        notes: isRecounting ? 'Reconteo de caja' : 'Conteo ciego inicial',
      });
      setIsRecounting(false);
      toast.success(isRecounting ? 'Reconteo guardado. Ya puede cerrar la caja.' : 'Arqueo enviado. La diferencia ya está disponible.');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al guardar el arqueo');
    }
  };

  const startRecount = () => {
    resetDenominations();
    setIsRecounting(true);
  };

  const handleClose = () => {
    setIsCloseAlertOpen(true);
  };

  const confirmCloseAction = async () => {
    try {
      const denoms = buildDenominations();

      await onConfirmClose({
        finalAmountNIO: contadoNIO,
        finalAmountUSD: contadoUSD,
        denominations: denoms,
        notes: diferencia !== 0 ? `Diferencia de ${symbol} ${formatSalesAmount(diferencia)}` : 'Cuadre exacto',
        countAttempt: latestCount?.attempt,
      });
      setIsCloseAlertOpen(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al cerrar sesión');
    }
  };

  const totalVentasNIO = logs.filter(l => l.type === 'SALE').reduce((acc, l) => acc + Number(l.amountNIO || 0), 0);
  const totalVentasUSD = logs.filter(l => l.type === 'SALE').reduce((acc, l) => acc + Number(l.amountUSD || 0), 0);
  const ventasConverted = isUSD
    ? (totalVentasUSD + (totalVentasNIO / sessionRate))
    : (totalVentasNIO + (totalVentasUSD * sessionRate));

  const totalGastosNIO = logs.filter(l => l.type === 'EXIT').reduce((acc, l) => acc + Number(l.amountNIO || 0), 0);
  const totalGastosUSD = logs.filter(l => l.type === 'EXIT').reduce((acc, l) => acc + Number(l.amountUSD || 0), 0);
  const gastosConverted = isUSD
    ? (totalGastosUSD + (totalGastosNIO / sessionRate))
    : (totalGastosNIO + (totalGastosUSD * sessionRate));

  const fondoInicialNIO = Number(session.initialAmountNIO || 0);
  const fondoInicialUSD = Number(session.initialAmountUSD || 0);
  const fondoInicialConverted = isUSD 
    ? (fondoInicialUSD + (fondoInicialNIO / sessionRate))
    : (fondoInicialNIO + (fondoInicialUSD * sessionRate));

  const { user } = useAuth();
  const { themeConfig } = useTheme();

  const handlePrintSummary = async () => {
    try {
      toast.promise(
        generateSessionSummaryPDF({
          session,
          logs,
          tenantName: user?.tenantName || 'Nuestra Empresa',
          tenantLogo: themeConfig?.logo,
          displayCurrency,
          isUSD,
          sessionRate,
          totals: {
            fondoInicial: fondoInicialConverted,
            ventas: ventasConverted,
            gastos: gastosConverted,
            esperado: totalExpectedConverted,
            contado: totalContadoConverted,
            diferencia: diferencia,
            hideSystemAmounts: isBlind && !hasSubmittedBlindCount,
          },
          hideSystemAmounts: isBlind && !hasSubmittedBlindCount,
        }),
        {
          loading: 'Generando resumen...',
          success: 'Resumen descargado',
          error: 'Error al generar resumen'
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {showSystemAmounts ? <>
        {/* Fondo Inicial */}
        <Card className="border-border/50 shadow-sm bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-yellow-500/10 rounded-xl">
              <Vault className="size-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Fondo Inicial</p>
              <p className="text-xl font-black font-mono">{symbol} {formatSalesAmount(fondoInicialConverted)}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">C$ {formatSalesAmount(fondoInicialNIO)} | $ {formatSalesAmount(fondoInicialUSD)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Ventas Totales */}
        <Card className="border-border/50 shadow-sm bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <BarChart3 className="size-5 text-blue-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Ventas Totales</p>
              <p className="text-xl font-black font-mono">{symbol} {formatSalesAmount(ventasConverted)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Gastos Registrados */}
        <Card className="border-border/50 shadow-sm bg-card/50">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-destructive/10 rounded-xl">
              <ArrowDownToLine className="size-5 text-destructive" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Gastos Registrados</p>
              <p className="text-xl font-black font-mono">{symbol} {formatSalesAmount(gastosConverted)}</p>
            </div>
          </CardContent>
        </Card>

        {/* Saldo Esperado */}
        <Card className="border-border/50 shadow-sm bg-card/50 border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Calculator className="size-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Saldo Esperado</p>
              <p className="text-xl font-black font-mono text-emerald-500">{symbol} {formatSalesAmount(totalExpectedConverted)}</p>
              <p className="text-[9px] text-emerald-600 mt-0.5">C$ {formatSalesAmount(expectedNIO)} | $ {formatSalesAmount(expectedUSD)}</p>
            </div>
          </CardContent>
        </Card>
        </> : (
          <Card className="sm:col-span-2 md:col-span-4 border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <Lock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-amber-700">Arqueo a ciegas</p>
                <p className="text-xs text-amber-700/80 mt-1">Realice el conteo físico y envíelo. Los importes del sistema se mostrarán después del primer conteo.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <MovimientoManualModal 
          open={modalOpen} 
          onOpenChange={setModalOpen} 
          onAddMovement={onAddMovement} 
        />

      {/* Seccion Izquierda: Transacciones */}
      <Card className="lg:col-span-7 border-border/50 shadow-sm bg-card/50">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-border/40 px-6 py-5">
          <div>
            <CardTitle className="text-sm font-black uppercase tracking-wider text-card-foreground">Transacciones del Turno</CardTitle>
            <CardDescription className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
              Historial de tickets y salidas de dinero
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setModalOpen(true)} variant="outline" className="h-8 text-xs font-bold shadow-sm border-border hover:bg-muted/60">
              <Plus className="size-3 mr-1" /> MOVIMIENTO
            </Button>
            <Button 
              onClick={() => {
                if (onNavigateToFacturacion) {
                  onNavigateToFacturacion();
                } else {
                  window.location.href = '/ventas?tab=facturacion-caja';
                }
              }} 
              className="h-8 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              IR A FACTURACIÓN
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className={`hidden xl:grid ${showSystemAmounts ? 'grid-cols-[minmax(4.5rem,.8fr)_minmax(3.5rem,.7fr)_minmax(0,2fr)_auto_minmax(6.5rem,auto)]' : 'grid-cols-[minmax(4.5rem,.8fr)_minmax(3.5rem,.7fr)_minmax(0,2fr)_auto]'} gap-3 px-3 sm:px-6 py-3 border-b border-border/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground`}>
            <div>Ref / Ticket</div>
            <div>Tipo</div>
            <div>Descripción</div>
            <div className="text-center whitespace-nowrap">Hora</div>
            {showSystemAmounts && <div className="text-right whitespace-nowrap">Monto</div>}
          </div>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2 px-3 py-3 xl:space-y-0 xl:px-0 xl:py-0 xl:divide-y xl:divide-border/40">
              {logs.map((log) => {
                const logNIO = Number(log.amountNIO || 0);
                const logUSD = Number(log.amountUSD || 0);
                const logConverted = isUSD 
                  ? (logUSD + (logNIO / sessionRate))
                  : (logNIO + (logUSD * sessionRate));

                return (
                <div key={log.id} className={`flex flex-col gap-2 rounded-xl border border-border/50 bg-card px-3 py-3 text-sm shadow-sm transition-colors hover:bg-muted/10 xl:grid ${showSystemAmounts ? 'xl:grid-cols-[minmax(4.5rem,.8fr)_minmax(3.5rem,.7fr)_minmax(0,2fr)_auto_minmax(6.5rem,auto)]' : 'xl:grid-cols-[minmax(4.5rem,.8fr)_minmax(3.5rem,.7fr)_minmax(0,2fr)_auto]'} xl:gap-3 xl:rounded-none xl:border-0 xl:bg-transparent xl:px-3 xl:py-3 xl:shadow-none`}>
                  <div className="min-w-0 truncate font-mono text-xs text-muted-foreground" title={log.reference || ''}>
                    {(() => {
                      if (log.type === 'SALE' && log.description?.includes('Factura')) {
                        const match = log.description.match(/FC-\d{4}-\d{5}/);
                        if (match) return match[0];
                      }
                      if (log.reference) {
                        return log.reference.length > 12 ? log.reference.slice(0, 8).toUpperCase() : log.reference.toUpperCase();
                      }
                      return log.type === 'SALE' ? 'TKT-' + log.id.slice(0,4).toUpperCase() : 'GST-' + log.id.slice(0,4).toUpperCase();
                    })()}
                  </div>
                  <div className="min-w-0 truncate">
                    {renderLogIcon(log.type)}
                  </div>
                  <div className="min-w-0 truncate text-sm font-medium" title={log.description || ''}>
                    {log.type === 'SALE' && log.description?.includes('Factura') 
                      ? 'Cobro de Venta (POS)' 
                      : log.description}
                  </div>
                  <div className="text-left text-xs text-muted-foreground whitespace-nowrap xl:text-center">
                    {new Date(log.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  {showSystemAmounts && (
                    <div className={`min-w-0 text-right font-mono text-sm font-bold flex flex-col items-end justify-center whitespace-nowrap ${log.type === 'EXIT' ? 'text-destructive' : log.type === 'OPEN' ? 'text-muted-foreground' : 'text-emerald-500'}`}>
                      <span>{log.type === 'EXIT' ? '-' : '+'}{symbol} {formatSalesAmount(logConverted)}</span>
                      <span className="text-[9px] opacity-70 font-normal mt-0.5 whitespace-nowrap">
                        C$ {formatSalesAmount(logNIO)} | $ {formatSalesAmount(logUSD)}
                      </span>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </ScrollArea>
          <div className="p-4 border-t border-border/40 flex flex-wrap gap-3 justify-between items-center bg-muted/10 rounded-b-xl text-xs text-muted-foreground">
            <span className="min-w-0">Tip: Revisa los gastos detalladamente antes del cierre.</span>
            <Button variant="outline" size="sm" className="h-7 text-[11px] font-bold" onClick={handlePrintSummary}>
              <Printer className="size-3 mr-2" /> Imprimir Resumen
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Seccion Derecha: Arqueo Fisico */}
      <Card className="lg:col-span-5 border-border/50 shadow-sm bg-card/50">
        <CardHeader className="pb-4 px-5 pt-5">
          <CardTitle className="text-sm font-black uppercase tracking-wider">Arqueo Físico</CardTitle>
          <CardDescription className="text-xs uppercase tracking-widest text-muted-foreground mt-0.5">
            Conteo de billetes en gaveta
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <DenominationCounter 
            nioDenominations={nioDenominations} setNioDenominations={setNioDenominations}
            usdDenominations={usdDenominations} setUsdDenominations={setUsdDenominations}
            totalNIO={contadoNIO} totalUSD={contadoUSD}
            stackedLayout={true}
          />
          
          <div className="mt-6 p-4 bg-muted/20 border border-border/50 rounded-xl text-center space-y-1">
            <div className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Efectivo Contado (Equivalente {isUSD ? 'USD' : 'NIO'})</div>
            <div className="text-2xl font-black font-mono">{symbol} {formatSalesAmount(totalContadoConverted)}</div>
            <div className="text-xs text-muted-foreground mt-1">C$ {formatSalesAmount(contadoNIO)} | $ {formatSalesAmount(contadoUSD)}</div>
          </div>

          {showSystemAmounts && (
            <div className={`p-4 border rounded-xl text-center space-y-1 transition-colors ${diferencia === 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-destructive/10 border-destructive/20'}`}>
              <div className={`text-[10px] uppercase font-black tracking-widest ${diferencia === 0 ? 'text-emerald-600' : 'text-destructive'}`}>Diferencia VS Sistema</div>
              <div className={`text-xl font-black font-mono ${diferencia === 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                {symbol} {diferencia > 0 ? '+' : ''}{formatSalesAmount(diferencia)}
              </div>
            </div>
          )}

          {isBlind && !hasSubmittedBlindCount ? (
            <Button onClick={submitBlindCount} className="w-full h-12 mt-4 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all rounded-xl">
              <Lock className="size-4 mr-2" /> ENVIAR ARQUEO A CIEGAS
            </Button>
          ) : isBlind && isRecounting ? (
            <Button onClick={submitBlindCount} className="w-full h-12 mt-4 font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-sm transition-all rounded-xl">
              <Lock className="size-4 mr-2" /> GUARDAR RECONTEO
            </Button>
          ) : (
            <div className="space-y-2 mt-4">
              {canRecount && (
                <Button onClick={startRecount} variant="outline" className="w-full h-10 font-bold rounded-xl">
                  <Calculator className="size-4 mr-2" /> RECONTAR CAJA (OPCIONAL)
                </Button>
              )}
              <Button onClick={handleClose} className="w-full h-12 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all rounded-xl">
                <Lock className="size-4 mr-2" /> {isBlind ? 'CERRAR CAJA CON ESTE CONTEO' : 'INICIAR CIERRE DE CAJA'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      </div>

      <AlertDialog open={isCloseAlertOpen} onOpenChange={setIsCloseAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar Caja?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Está seguro de cerrar la caja definitivamente? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCloseAction} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              Cerrar Caja
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
