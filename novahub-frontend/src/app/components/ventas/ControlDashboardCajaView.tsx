import { Fragment, useState, useEffect } from 'react';
import { useCajaSession } from '../../hooks/useCajaSession';
import { cajaService, CashRegister } from '../../services/caja.service';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Loader2, Coins, Settings2, Eye } from 'lucide-react';
import { DashboardCajaView } from './DashboardCajaView';
import { AperturaCajaStep } from './caja/AperturaCajaStep';
import { SesionActivaStep } from './caja/SesionActivaStep';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Button } from '../ui/button';
import { AdministrarCajasModal } from './caja/AdministrarCajasModal';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { useCurrency } from '../../contexts/CurrencyContext';
import { CajaSetupGuide } from './caja/CajaSetupGuide';
import { getApiErrorMessage } from '../../services/api';

type SectionType = 'dashboard' | 'session' | 'history';

export function ControlDashboardCajaView({ 
  onNavigateToFacturacion,
  initialRegisterId,
  initialSection
}: { 
  onNavigateToFacturacion?: () => void;
  initialRegisterId?: string;
  initialSection?: SectionType;
}) {
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<string>(initialRegisterId || '');
  const [activeSection, setActiveSection] = useState<SectionType>(initialSection || 'dashboard');
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [manageCajasOpen, setManageCajasOpen] = useState(false);

  const { displayCurrency, exchangeRate: globalRate } = useCurrency();
  const isUSD = displayCurrency === 'USD';
  const symbol = isUSD ? '$' : 'C$';

  const {
    session,
    logs,
    loading,
    sessionStep,
    setSessionStep,
    closureMode,
    countAttempts,
    savePartialCount,
    expectedNIO,
    expectedUSD,
    openSession,
    addMovement,
    closeSession,
  } = useCajaSession(selectedRegister);

  useEffect(() => {
    loadRegisters();
  }, []);

  useEffect(() => {
    if (activeSection === 'history' && selectedRegister) {
      loadHistory();
    }
  }, [activeSection, selectedRegister]);

  useEffect(() => {
    if (initialRegisterId) setSelectedRegister(initialRegisterId);
    if (initialSection) setActiveSection(initialSection);
  }, [initialRegisterId, initialSection]);

  const loadRegisters = async () => {
    try {
      const res = await cajaService.getRegisters();
      const registersData = Array.isArray(res) ? res : ((res as any)?.data || []);
      setRegisters(registersData);
      if (registersData.length > 0 && !selectedRegister) {
        const openRegister = registersData.find((r: any) => r.hasActiveSession);
        setSelectedRegister(openRegister ? openRegister.id : registersData[0].id);
      }
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al cargar cajas'));
    }
  };

  const loadHistory = async () => {
    try {
      const data = await cajaService.getSessionHistory(selectedRegister === 'ALL' ? undefined : selectedRegister);
      setHistoryItems(data.items || []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Error al cargar historial de caja'));
    }
  };

  if (loading && (!registers || registers.length === 0)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary size-8" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header Unificado Minimalista */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-border/40">
        
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <Coins className="size-5 text-primary" /> Control de Caja
            </h2>
            <Button 
              size="sm" 
              onClick={() => setManageCajasOpen(true)}
              className="h-7 px-3 gap-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90 transition-all rounded-full shadow-sm"
            >
              <Settings2 className="size-3" /> Administrar Cajas
            </Button>
          </div>

          <Tabs value={activeSection} onValueChange={(v: any) => setActiveSection(v)} className="w-full mt-4">
            <TabsList className="w-full h-auto bg-gradient-to-br from-muted/30 to-muted/50 backdrop-blur-sm p-1.5 flex overflow-x-auto justify-start pb-2 flex-nowrap gap-1.5 rounded-2xl border border-border/40 mb-2">
              <TabsTrigger 
                value="session"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                  data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                  data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                Control de Cajas
              </TabsTrigger>
              <TabsTrigger 
                value="dashboard"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                  data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                  data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                Dashboard
              </TabsTrigger>
              <TabsTrigger 
                value="history"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest
                  data-[state=active]:bg-gradient-to-br data-[state=active]:from-primary data-[state=active]:to-primary/80
                  data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all"
              >
                Historial de Cajas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {session && (
            <Badge variant={session.status === 'COUNTING' ? 'secondary' : 'default'} className="font-bold text-xs h-9 px-3 flex items-center shadow-none pointer-events-none">
              {session.status === 'COUNTING' ? 'EN ARQUEO' : 'ABIERTA'}
            </Badge>
          )}
          <Select value={selectedRegister} onValueChange={setSelectedRegister}>
            <SelectTrigger className="h-9 w-full md:w-[220px] font-medium bg-background shadow-sm border-border/60">
              <SelectValue placeholder="Seleccione caja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="font-bold text-primary">Todas las cajas (Global)</SelectItem>
              {registers?.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name} ({r.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contenido Dinámico */}
      <div className="min-h-[400px]">
        {activeSection === 'dashboard' && (
          <DashboardCajaView 
            onNavigateToFacturacion={onNavigateToFacturacion || (() => {})} 
            registerId={selectedRegister === 'ALL' ? undefined : selectedRegister} 
          />
        )}

        {activeSection === 'session' && selectedRegister === 'ALL' && (
          <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
            <p className="text-muted-foreground text-sm font-medium">Seleccione una caja específica para abrir, cerrar o ver su sesión actual.</p>
          </div>
        )}

        {activeSection === 'session' && selectedRegister !== 'ALL' && (
          <div className="space-y-4">
            <CajaSetupGuide
              registers={registers}
              selectedRegister={selectedRegister}
              onSelectRegister={setSelectedRegister}
              onRegistersChanged={loadRegisters}
            />

            {sessionStep === 'idle' && (
              <AperturaCajaStep 
                selectedRegister={selectedRegister} 
                onOpenSession={openSession} 
              />
            )}

            {(sessionStep === 'active' || sessionStep === 'close_counting') && session && (
              <SesionActivaStep 
                session={session} 
                logs={logs} 
                closureMode={closureMode}
                countAttempts={countAttempts}
                expectedNIO={expectedNIO} 
                expectedUSD={expectedUSD} 
                onAddMovement={addMovement} 
                onSubmitCount={savePartialCount}
                onConfirmClose={closeSession} 
                onNavigateToFacturacion={onNavigateToFacturacion}
              />
            )}
          </div>
        )}

        {activeSection === 'history' && (
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Historial de Sesiones</CardTitle>
            </CardHeader>
            <CardContent>
              {historyItems.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No hay sesiones registradas en esta caja.</p>
              ) : (
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {historyItems.map(h => {
                    const initialNIO = Number(h.initialAmountNIO || 0);
                    const initialUSD = Number(h.initialAmountUSD || 0);
                    const rate = h.exchangeRateUSD || globalRate;
                    const isBlindBeforeCount = h.closureMode === 'BLIND' && h.status === 'OPEN' && !(h.countAttempts?.length);
                    const initialConverted = isUSD ? (initialUSD + initialNIO / rate) : (initialNIO + initialUSD * rate);

                    const diffNIO = Number(h.differenceNIO || 0);
                    const diffUSD = Number(h.differenceUSD || 0);
                    const diffConverted = isUSD ? (diffUSD + diffNIO / rate) : (diffNIO + diffUSD * rate);

                    let expectedNIO = h.expectedAmountNIO != null ? Number(h.expectedAmountNIO) : initialNIO;
                    let expectedUSD = h.expectedAmountUSD != null ? Number(h.expectedAmountUSD) : initialUSD;

                    if (h.expectedAmountNIO == null && h.log) {
                      h.log.forEach((log: any) => {
                        if (log.type === 'SALE' || log.type === 'ENTRY') {
                          if (!log.paymentMethod || log.paymentMethod === 'CASH') {
                            expectedNIO += Number(log.amountNIO || 0);
                            expectedUSD += Number(log.amountUSD || 0);
                          }
                        } else if (log.type === 'EXIT') {
                          if (!log.paymentMethod || log.paymentMethod === 'CASH') {
                            expectedNIO -= Number(log.amountNIO || 0);
                            expectedUSD -= Number(log.amountUSD || 0);
                          }
                        }
                      });
                    }

                    const expectedConverted = isUSD ? (expectedUSD + expectedNIO / rate) : (expectedNIO + expectedUSD * rate);

                    const finalNIO = Number(h.finalAmountNIO || 0);
                    const finalUSD = Number(h.finalAmountUSD || 0);
                    const finalConverted = isUSD ? (finalUSD + finalNIO / rate) : (finalNIO + finalUSD * rate);

                    return (
                    <AccordionItem key={h.id} value={h.id} className="border border-border/50 rounded-lg bg-card/50 px-4">
                      <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center gap-4 w-full text-sm">
                          <Badge variant={h.status === 'CLOSED' ? 'outline' : h.status === 'COUNTING' ? 'secondary' : 'default'} className="w-24 justify-center pointer-events-none shadow-none">
                            {h.status === 'CLOSED' ? 'CERRADA' : h.status === 'COUNTING' ? 'EN ARQUEO' : 'ABIERTA'}
                          </Badge>
                          <div className="flex-1 text-left">
                            <p className="font-bold">{new Date(h.openedAt).toLocaleString()}</p>
                            {selectedRegister === 'ALL' && h.cashRegister && (
                              <p className="text-[10px] text-primary font-black uppercase tracking-widest">{h.cashRegister.code} - {h.cashRegister.name}</p>
                            )}
                            <p className="text-xs text-muted-foreground">Por: {h.openedBy?.name}</p>
                          </div>
                          <div className="text-right flex flex-col items-end">
                            {isBlindBeforeCount ? (
                              <p className="text-xs font-bold text-amber-600">Importes ocultos</p>
                            ) : <>
                              <p className="text-xs text-muted-foreground">Inicial</p>
                              <p className="font-mono font-bold">{symbol} {initialConverted.toFixed(2)}</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5 font-normal">C$ {initialNIO.toFixed(2)} | $ {initialUSD.toFixed(2)}</p>
                            </>}
                          </div>
                          {h.status === 'CLOSED' && (
                            <div className="text-right ml-4 flex flex-col items-end">
                              <p className="text-xs text-muted-foreground">Diferencia</p>
                              <p className={`font-mono font-bold ${diffConverted < 0 ? 'text-red-500' : diffConverted > 0 ? 'text-green-500' : 'text-emerald-500'}`}>
                                {symbol} {diffConverted > 0 ? '+' : ''}{diffConverted.toFixed(2)}
                              </p>
                              <p className={`text-[9px] mt-0.5 font-normal ${diffConverted < 0 ? 'text-red-400/70' : diffConverted > 0 ? 'text-green-400/70' : 'text-emerald-400/70'}`}>C$ {diffNIO.toFixed(2)} | $ {diffUSD.toFixed(2)}</p>
                            </div>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-2 pb-6 border-t border-border/40">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                          {/* Desgloses */}
                          <div className="space-y-6">
                            <div className="flex items-center gap-4">
                              <h4 className="text-xs font-black tracking-widest text-muted-foreground uppercase">Desglose de Apertura</h4>
                              {h.denominations?.filter((d: any) => d.phase === 'OPEN').length > 0 ? (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded-full">
                                      <Eye className="size-3.5" /> Ver Desglose
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="sm:max-w-md">
                                    <DialogHeader>
                                      <DialogTitle>Desglose de Apertura</DialogTitle>
                                    </DialogHeader>
                                    
                                    <div className="bg-muted/50 p-4 rounded-xl mb-2 flex items-center justify-between">
                                      <span className="font-bold text-muted-foreground text-sm uppercase tracking-wider">Fondo Inicial</span>
                                      <div className="text-right">
                                        <div className="font-mono font-black text-lg">{symbol} {initialConverted.toFixed(2)}</div>
                                        <div className="text-[10px] text-muted-foreground">C$ {initialNIO.toFixed(2)} | $ {initialUSD.toFixed(2)}</div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                                      <div className="font-bold border-b pb-2">Denominación</div>
                                      <div className="font-bold border-b pb-2 text-right">Subtotal</div>
                                      {h.denominations.filter((d: any) => d.phase === 'OPEN').map((d: any, i: number) => (
                                        <Fragment key={i}>
                                          <div className="flex items-center">
                                            {d.currency === 'NIO' ? 'C$' : '$'} {d.value} x {d.quantity}
                                          </div>
                                          <div className="font-mono text-right font-medium">
                                            {Number(d.subtotal).toFixed(2)}
                                          </div>
                                        </Fragment>
                                      ))}
                                    </div>
                                  </DialogContent>
                                </Dialog>
                              ) : (
                                <p className="text-xs text-muted-foreground">Sin desglose detallado</p>
                              )}
                            </div>
                            
                            {h.status === 'CLOSED' && (
                              <div className="flex items-center gap-4 mt-4">
                                <h4 className="text-xs font-black tracking-widest text-muted-foreground uppercase">Desglose de Arqueo (Cierre)</h4>
                                {h.denominations?.filter((d: any) => d.phase === 'CLOSE').length > 0 ? (
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 rounded-full">
                                        <Eye className="size-3.5" /> Ver Desglose
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                      <DialogHeader>
                                        <DialogTitle>Desglose de Arqueo (Cierre)</DialogTitle>
                                      </DialogHeader>

                                      <div className="bg-muted/30 p-4 rounded-xl mb-2 space-y-3">
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                          <span className="text-sm font-medium text-muted-foreground">Fondo Inicial</span>
                                          <div className="text-right">
                                            <div className="font-mono font-bold">{symbol} {initialConverted.toFixed(2)}</div>
                                            <div className="text-[10px] text-muted-foreground">C$ {initialNIO.toFixed(2)} | $ {initialUSD.toFixed(2)}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                          <span className="text-sm font-medium text-muted-foreground">Esperado en Sistema</span>
                                          <div className="text-right">
                                            <div className="font-mono font-bold">{symbol} {expectedConverted.toFixed(2)}</div>
                                            <div className="text-[10px] text-muted-foreground">C$ {expectedNIO.toFixed(2)} | $ {expectedUSD.toFixed(2)}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between border-b border-border/50 pb-2">
                                          <span className="text-sm font-medium text-muted-foreground">Físico Contado (Arqueo)</span>
                                          <div className="text-right">
                                            <div className="font-mono font-bold">{symbol} {finalConverted.toFixed(2)}</div>
                                            <div className="text-[10px] text-muted-foreground">C$ {finalNIO.toFixed(2)} | $ {finalUSD.toFixed(2)}</div>
                                          </div>
                                        </div>
                                        <div className="flex items-center justify-between pt-1">
                                          <span className="text-sm font-black uppercase tracking-wider">Diferencia</span>
                                          <div className="text-right">
                                            <div className={`font-mono font-black text-lg ${diffConverted < 0 ? 'text-destructive' : diffConverted > 0 ? 'text-emerald-500' : 'text-emerald-500'}`}>
                                              {symbol} {diffConverted > 0 ? '+' : ''}{diffConverted.toFixed(2)}
                                            </div>
                                            <div className={`text-[10px] ${diffConverted < 0 ? 'text-destructive/70' : diffConverted > 0 ? 'text-emerald-500/70' : 'text-emerald-500/70'}`}>
                                              C$ {diffNIO.toFixed(2)} | $ {diffUSD.toFixed(2)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 text-sm">
                                        <div className="font-bold border-b pb-2">Denominación</div>
                                        <div className="font-bold border-b pb-2 text-right">Subtotal</div>
                                        {h.denominations.filter((d: any) => d.phase === 'CLOSE').map((d: any, i: number) => (
                                          <Fragment key={i}>
                                            <div className="flex items-center">
                                              {d.currency === 'NIO' ? 'C$' : '$'} {d.value} x {d.quantity}
                                            </div>
                                            <div className="font-mono text-right font-medium">
                                              {Number(d.subtotal).toFixed(2)}
                                            </div>
                                          </Fragment>
                                        ))}
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                ) : (
                                  <p className="text-xs text-muted-foreground">Sin desglose detallado</p>
                                )}
                              </div>
                            )}
                          </div>
                          {h.countAttempts?.length > 0 && (
                            <div className="space-y-2 mt-6">
                              <h4 className="text-xs font-black tracking-widest text-muted-foreground uppercase">Conteos realizados</h4>
                              <div className="space-y-2">
                                {h.countAttempts.map((attempt: any) => {
                                  const countedNIO = Number(attempt.countedAmountNIO || 0);
                                  const countedUSD = Number(attempt.countedAmountUSD || 0);
                                  const attemptDiffNIO = Number(attempt.differenceNIO || 0);
                                  const attemptDiffUSD = Number(attempt.differenceUSD || 0);
                                  const countedConverted = isUSD ? (countedUSD + countedNIO / rate) : (countedNIO + countedUSD * rate);
                                  const attemptDiffConverted = isUSD ? (attemptDiffUSD + attemptDiffNIO / rate) : (attemptDiffNIO + attemptDiffUSD * rate);
                                  return (
                                    <div key={attempt.id || attempt.attempt} className="rounded-lg border border-border/40 bg-muted/10 p-3 text-xs">
                                      <div className="flex items-center justify-between gap-3">
                                        <div>
                                          <p className="font-bold">{attempt.attempt === 1 ? 'Conteo inicial' : 'Reconteo'} · {attempt.mode === 'BLIND' ? 'Ciego' : 'Normal'}</p>
                                          <p className="text-[10px] text-muted-foreground">{attempt.capturedBy?.name || 'Usuario'} · {attempt.createdAt ? new Date(attempt.createdAt).toLocaleString() : ''}</p>
                                        </div>
                                        <div className="text-right font-mono">
                                          <p className="font-bold">{symbol} {countedConverted.toFixed(2)}</p>
                                          <p className={attemptDiffConverted < 0 ? 'text-destructive' : 'text-emerald-500'}>Dif. {attemptDiffConverted > 0 ? '+' : ''}{attemptDiffConverted.toFixed(2)}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Movimientos */}
                          <div>
                            <h4 className="text-xs font-black tracking-widest text-muted-foreground uppercase mb-2">Movimientos del Turno</h4>
                            {h.log?.length > 0 ? (
                              <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                                {h.log.map((log: any) => {
                                  const logNIO = Number(log.amountNIO || 0);
                                  const logUSD = Number(log.amountUSD || 0);
                                  const logConverted = isUSD ? (logUSD + (logNIO / rate)) : (logNIO + (logUSD * rate));
                                  const typeLabel = log.type === 'SALE' ? 'VENTA' : log.type === 'EXIT' ? 'GASTO' : log.type === 'ENTRY' ? 'ENTRADA' : log.type === 'OPEN' ? 'APERTURA' : log.type;

                                  return (
                                  <div key={log.id} className="flex items-center justify-between text-xs bg-muted/20 p-2 rounded-md border border-border/30">
                                    <div className="flex-1">
                                      <p className="font-bold">{log.description}</p>
                                      <p className="text-[10px] text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()} • {typeLabel}</p>
                                    </div>
                                    {!isBlindBeforeCount && (
                                      <div className={`font-mono font-bold text-right flex flex-col items-end justify-center ${log.type === 'EXIT' ? 'text-red-500' : 'text-green-500'}`}>
                                        <span>{log.type === 'EXIT' ? '-' : '+'}{symbol} {logConverted.toFixed(2)}</span>
                                        <span className={`text-[9px] font-normal mt-0.5 ${log.type === 'EXIT' ? 'text-red-400/70' : 'text-green-400/70'}`}>
                                          C$ {logNIO.toFixed(2)} | $ {logUSD.toFixed(2)}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )})}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No hay movimientos registrados.</p>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                  })}
                </Accordion>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <AdministrarCajasModal 
        open={manageCajasOpen} 
        onOpenChange={setManageCajasOpen}
        onRegistersChanged={loadRegisters}
      />
    </div>
  );
}
