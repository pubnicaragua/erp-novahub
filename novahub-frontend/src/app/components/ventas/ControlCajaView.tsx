import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { api } from '../../services/api';
import { cajaService, CashRegisterSession, CashRegister } from '../../services/caja.service';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '../ui/accordion';
import { ScrollArea } from '../ui/scroll-area';
import { Loader2, DollarSign, Calculator, Lock, History, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '../ui/table';

const NIO_BILLS = [1000, 500, 200, 100, 50, 20, 10];
const NIO_COINS = [10, 5, 1, 0.50, 0.25];
const USD_BILLS = [100, 50, 20, 10, 5, 2, 1];
const USD_COINS = [0.50, 0.25, 0.10, 0.05, 0.01];

interface DenominationState {
  value: number;
  quantity: number;
}

export function ControlCajaView() {
  const { user } = useAuth();
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<string>('');
  
  const [session, setSession] = useState<CashRegisterSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // Apertura / Arqueo / Cierre State
  const [exchangeRateUSD, setExchangeRateUSD] = useState(36.5);
  const [nioDenominations, setNioDenominations] = useState<DenominationState[]>([
    ...NIO_BILLS.map(v => ({ value: v, quantity: 0 })),
    ...NIO_COINS.map(v => ({ value: v, quantity: 0 }))
  ]);
  const [usdDenominations, setUsdDenominations] = useState<DenominationState[]>([
    ...USD_BILLS.map(v => ({ value: v, quantity: 0 })),
    ...USD_COINS.map(v => ({ value: v, quantity: 0 }))
  ]);
  
  const [notes, setNotes] = useState('');
  const [isCounting, setIsCounting] = useState(false);

  useEffect(() => {
    loadRegisters();
  }, []);

  useEffect(() => {
    if (selectedRegister) {
      loadSessionData();
    }
  }, [selectedRegister]);

  const loadRegisters = async () => {
    try {
      const res = await cajaService.getRegisters();
      // Ensure we always set an array
      const registersData = Array.isArray(res) ? res : ((res as any)?.data || []);
      setRegisters(registersData);
      if (registersData.length > 0) {
        setSelectedRegister(registersData[0].id);
      }
      setLoading(false);
    } catch (err) {
      toast.error('Error al cargar cajas');
      setLoading(false);
    }
  };

  const loadSessionData = async () => {
    setLoading(true);
    try {
      const active = await cajaService.getActiveSession(selectedRegister);
      setSession(active || null);
      if (active) {
        const logData = await cajaService.getSessionLog(active.id);
        setLogs(logData || []);
      }
      const historyData = await cajaService.getSessionHistory(selectedRegister);
      setHistory(historyData.items || []);
    } catch (err) {
      toast.error('Error al cargar datos de sesión');
    } finally {
      setLoading(false);
    }
  };

  const calcTotalNIO = () => nioDenominations.reduce((acc, d) => acc + (d.value * d.quantity), 0);
  const calcTotalUSD = () => usdDenominations.reduce((acc, d) => acc + (d.value * d.quantity), 0);

  const resetDenominations = () => {
    setNioDenominations([...NIO_BILLS, ...NIO_COINS].map(v => ({ value: v, quantity: 0 })));
    setUsdDenominations([...USD_BILLS, ...USD_COINS].map(v => ({ value: v, quantity: 0 })));
    setNotes('');
  };

  const handleOpenSession = async () => {
    try {
      const initialNIO = calcTotalNIO();
      const initialUSD = calcTotalUSD();
      
      const denoms = [
        ...nioDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'NIO', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity })),
        ...usdDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'USD', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity }))
      ];

      await cajaService.openSession({
        cashRegisterId: selectedRegister,
        exchangeRateUSD,
        initialAmountNIO: initialNIO,
        initialAmountUSD: initialUSD,
        denominations: denoms,
        notes
      });
      toast.success('Caja aperturada exitosamente');
      resetDenominations();
      loadSessionData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al aperturar caja');
    }
  };

  const handleCountSession = async () => {
    try {
      if (!session) return;
      const denoms = [
        ...nioDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'NIO', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity })),
        ...usdDenominations.filter(d => d.quantity > 0).map(d => ({ currency: 'USD', value: d.value, quantity: d.quantity, subtotal: d.value * d.quantity }))
      ];

      await cajaService.countSession(session.id, { denominations: denoms, notes });
      toast.success('Arqueo guardado');
      setIsCounting(false);
      loadSessionData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al realizar arqueo');
    }
  };

  const handleCloseSession = async () => {
    try {
      if (!session) return;
      
      // Calculate expected amounts (Initial + Sales - Refunds etc)
      // For simplicity, we sum logs
      const expectedNIO = session.initialAmountNIO + logs.filter(l => l.type === 'SALE').reduce((acc, l) => acc + Number(l.amountNIO || 0), 0);
      const expectedUSD = session.initialAmountUSD + logs.filter(l => l.type === 'SALE').reduce((acc, l) => acc + Number(l.amountUSD || 0), 0);
      
      const finalNIO = calcTotalNIO();
      const finalUSD = calcTotalUSD();
      
      const diffNIO = finalNIO - expectedNIO;
      const diffUSD = finalUSD - expectedUSD;

      if (diffNIO !== 0 || diffUSD !== 0) {
        if (!confirm(`Hay una diferencia de C$${diffNIO.toFixed(2)} y $${diffUSD.toFixed(2)}. ¿Desea continuar con el cierre?`)) {
          return;
        }
      }

      await cajaService.closeSession(session.id, {
        finalAmountNIO: finalNIO,
        finalAmountUSD: finalUSD,
        differenceNIO: diffNIO,
        differenceUSD: diffUSD,
        notes
      });
      
      // Export PDF report automatically on close
      exportSessionReport(session, expectedNIO, finalNIO, diffNIO, expectedUSD, finalUSD, diffUSD);
      
      toast.success('Sesión cerrada');
      setIsCounting(false);
      resetDenominations();
      loadSessionData();
      
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al cerrar sesión');
    }
  };

  const exportSessionReport = (sess: CashRegisterSession, expNIO: number, finNIO: number, difNIO: number, expUSD: number, finUSD: number, difUSD: number) => {
    const doc = new jsPDF();
    const register = (registers || []).find(r => r.id === sess.cashRegisterId);
    
    doc.setFontSize(18);
    doc.text('Resumen de Cierre de Caja', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Caja: ${register?.name || sess.cashRegisterId}`, 14, 32);
    doc.text(`Apertura: ${new Date(sess.openedAt).toLocaleString()}`, 14, 38);
    doc.text(`Cierre: ${new Date().toLocaleString()}`, 14, 44);
    doc.text(`Cajero: ${sess.openedBy?.name || user?.name || 'Sistema'}`, 14, 50);
    
    (doc as any).autoTable({
      startY: 56,
      head: [['Concepto', 'Córdobas (C$)', 'Dólares (USD)']],
      body: [
        ['Fondo Inicial', Number(sess.initialAmountNIO).toFixed(2), Number(sess.initialAmountUSD).toFixed(2)],
        ['Ventas Totales', (expNIO - sess.initialAmountNIO).toFixed(2), (expUSD - sess.initialAmountUSD).toFixed(2)],
        ['Total Esperado en Sistema', expNIO.toFixed(2), expUSD.toFixed(2)],
        ['Total Arqueo Físico', finNIO.toFixed(2), finUSD.toFixed(2)],
        ['Diferencia de Caja', difNIO.toFixed(2), difUSD.toFixed(2)]
      ],
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] }, // emerald-500
    });
    
    doc.save(`Cierre_Caja_${register?.code || 'POS'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const renderDenominationInputs = (currency: 'NIO' | 'USD', isBills: boolean) => {
    const list = currency === 'NIO' 
      ? (isBills ? NIO_BILLS : NIO_COINS) 
      : (isBills ? USD_BILLS : USD_COINS);
      
    const state = currency === 'NIO' ? nioDenominations : usdDenominations;
    const setState = currency === 'NIO' ? setNioDenominations : setUsdDenominations;
    const prefix = currency === 'NIO' ? 'C$' : '$';

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {list.map(val => {
          const item = state.find(s => s.value === val);
          return (
            <div key={val} className="flex items-center gap-2 bg-muted/30 p-2 rounded-lg border border-border/50">
              <Label className="w-16 text-right shrink-0 font-mono text-xs">{prefix}{val}</Label>
              <Input 
                type="number" 
                min="0" 
                className="h-8 text-right font-mono" 
                value={item?.quantity || ''}
                onChange={(e) => {
                  const qty = parseInt(e.target.value) || 0;
                  setState(prev => prev.map(p => p.value === val ? { ...p, quantity: qty } : p));
                }}
              />
            </div>
          );
        })}
      </div>
    );
  };

  if (loading && (!registers || !registers.length)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-primary size-8" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Control de Caja</h2>
          <p className="text-muted-foreground text-sm">Apertura, arqueo y cierre de sesión operativa.</p>
        </div>
        <div className="w-64">
          <Label>Seleccionar Caja</Label>
          <Select value={selectedRegister} onValueChange={setSelectedRegister}>
            <SelectTrigger><SelectValue placeholder="Seleccione una caja" /></SelectTrigger>
            <SelectContent>
              {registers?.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.name} ({r.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!session && selectedRegister ? (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Apertura de Caja</CardTitle>
            <CardDescription>Ingrese el fondo inicial y el tipo de cambio del día.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="w-48">
              <Label>Tipo de Cambio (NIO/USD)</Label>
              <Input type="number" step="0.01" value={exchangeRateUSD} onChange={e => setExchangeRateUSD(Number(e.target.value))} />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* NIO Card */}
              <Card className="bg-muted/10">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                  <div className="font-semibold text-sm flex items-center gap-2">🇳🇮 Córdobas (NIO)</div>
                  <div className="font-mono font-bold text-primary">C$ {calcTotalNIO().toFixed(2)}</div>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="multiple" defaultValue={["bills-nio", "coins-nio"]}>
                    <AccordionItem value="bills-nio" className="border-none px-4">
                      <AccordionTrigger className="py-3 text-sm">Billetes</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('NIO', true)}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="coins-nio" className="border-none px-4">
                      <AccordionTrigger className="py-3 text-sm">Monedas</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('NIO', false)}</AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              
              {/* USD Card */}
              <Card className="bg-muted/10">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                  <div className="font-semibold text-sm flex items-center gap-2">🇺🇸 Dólares (USD)</div>
                  <div className="font-mono font-bold text-primary">$ {calcTotalUSD().toFixed(2)}</div>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="multiple" defaultValue={["bills-usd"]}>
                    <AccordionItem value="bills-usd" className="border-none px-4">
                      <AccordionTrigger className="py-3 text-sm">Billetes</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('USD', true)}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="coins-usd" className="border-none px-4 border-t">
                      <AccordionTrigger className="py-3 text-sm">Monedas</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('USD', false)}</AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={resetDenominations}>Limpiar</Button>
            <Button onClick={handleOpenSession}><Lock className="size-4 mr-2" /> Aperturar Caja</Button>
          </CardFooter>
        </Card>
      ) : null}

      {session && !isCounting ? (
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Sesión Activa: {session.status === 'COUNTING' ? 'En Arqueo' : 'Abierta'}</CardTitle>
                <CardDescription>Aperturada el {new Date(session.openedAt).toLocaleString()} por {session.openedBy?.name}</CardDescription>
              </div>
              <Badge variant={session.status === 'COUNTING' ? 'secondary' : 'default'}>{session.status}</Badge>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-muted/30 rounded-xl border border-border/50 text-center">
                  <div className="text-sm text-muted-foreground mb-1">Total Ingresos NIO</div>
                  <div className="text-2xl font-black font-mono">C$ {logs.filter(l => l.type === 'SALE').reduce((acc, l) => acc + Number(l.amountNIO || 0), 0).toFixed(2)}</div>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl border border-border/50 text-center">
                  <div className="text-sm text-muted-foreground mb-1">Fondo Inicial NIO</div>
                  <div className="text-2xl font-black font-mono">C$ {Number(session.initialAmountNIO).toFixed(2)}</div>
                </div>
              </div>
              
              <div className="flex justify-center">
                <Button size="lg" className="w-full max-w-sm font-bold" onClick={() => {
                  resetDenominations();
                  setIsCounting(true);
                }}>
                  <Calculator className="size-5 mr-2" /> Realizar Arqueo y Cierre
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="py-4">
              <CardTitle className="text-sm flex items-center gap-2"><History className="size-4" /> Log de Transacciones</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[300px]">
              <div className="px-4 pb-4 space-y-4">
                {logs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">{log.type}</span>
                      <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleTimeString()}</span>
                    </div>
                    <span className="text-muted-foreground text-xs">{log.description}</span>
                    {Number(log.amountNIO) > 0 && (
                      <span className="font-mono font-bold text-primary text-right">+ C${Number(log.amountNIO).toFixed(2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Card>
        </div>
      ) : null}

      {session && isCounting ? (
        <Card className="border-border/50 shadow-sm border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-lg">Arqueo y Cierre de Caja</CardTitle>
            <CardDescription>Cuente el dinero físico en caja e ingrese las cantidades.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* NIO Card */}
              <Card className="bg-muted/10">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                  <div className="font-semibold text-sm flex items-center gap-2">🇳🇮 Córdobas (NIO)</div>
                  <div className="font-mono font-bold text-primary">C$ {calcTotalNIO().toFixed(2)}</div>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="multiple" defaultValue={["bills-nio", "coins-nio"]}>
                    <AccordionItem value="bills-nio" className="border-none px-4">
                      <AccordionTrigger className="py-3 text-sm">Billetes</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('NIO', true)}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="coins-nio" className="border-none px-4">
                      <AccordionTrigger className="py-3 text-sm">Monedas</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('NIO', false)}</AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
              
              {/* USD Card */}
              <Card className="bg-muted/10">
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between border-b">
                  <div className="font-semibold text-sm flex items-center gap-2">🇺🇸 Dólares (USD)</div>
                  <div className="font-mono font-bold text-primary">$ {calcTotalUSD().toFixed(2)}</div>
                </CardHeader>
                <CardContent className="p-0">
                  <Accordion type="multiple" defaultValue={["bills-usd"]}>
                    <AccordionItem value="bills-usd" className="border-none px-4">
                      <AccordionTrigger className="py-3 text-sm">Billetes</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('USD', true)}</AccordionContent>
                    </AccordionItem>
                    <AccordionItem value="coins-usd" className="border-none px-4 border-t">
                      <AccordionTrigger className="py-3 text-sm">Monedas</AccordionTrigger>
                      <AccordionContent>{renderDenominationInputs('USD', false)}</AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </CardContent>
              </Card>
            </div>
            <div>
              <Label>Notas de Arqueo / Cierre</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ej. Billete de 100 dañado..." />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setIsCounting(false)}>Cancelar</Button>
            <Button variant="secondary" onClick={handleCountSession}>Guardar Arqueo Parcial</Button>
            <Button variant="destructive" onClick={handleCloseSession}>Confirmar Cierre Definitivo</Button>
          </CardFooter>
        </Card>
      ) : null}

      {!session && history.length > 0 && !loading && (
        <Card className="border-border/50 shadow-sm mt-8">
          <CardHeader>
            <CardTitle className="text-lg">Historial de Sesiones</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha Apertura</TableHead>
                  <TableHead>Cierre</TableHead>
                  <TableHead>Cajero</TableHead>
                  <TableHead className="text-right">Inicial (C$)</TableHead>
                  <TableHead className="text-right">Final (C$)</TableHead>
                  <TableHead className="text-right">Dif. (C$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell>{new Date(h.openedAt).toLocaleString()}</TableCell>
                    <TableCell>{h.closedAt ? new Date(h.closedAt).toLocaleString() : '-'}</TableCell>
                    <TableCell>{h.openedBy?.name}</TableCell>
                    <TableCell className="text-right font-mono">{Number(h.initialAmountNIO).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{Number(h.finalAmountNIO || 0).toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-mono ${Number(h.differenceNIO) < 0 ? 'text-red-500' : Number(h.differenceNIO) > 0 ? 'text-green-500' : ''}`}>
                      {Number(h.differenceNIO || 0).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
