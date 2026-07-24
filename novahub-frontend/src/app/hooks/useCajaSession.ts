import { useState, useEffect, useCallback } from 'react';
import { cajaService, CashRegisterSession, SessionLog } from '../services/caja.service';
import { toast } from 'sonner';

export type SessionStep = 'idle' | 'active' | 'close_counting';

export function useCajaSession(selectedRegister: string) {
  const [session, setSession] = useState<CashRegisterSession | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionStep, setSessionStep] = useState<SessionStep>('idle');

  const loadSessionData = useCallback(async () => {
    if (!selectedRegister) return;
    setLoading(true);
    setSession(null);
    setLogs([]);
    setSessionStep('idle');
    try {
      const active = await cajaService.getActiveSession(selectedRegister);
      setSession(active || null);
      if (active) {
        const logData = await cajaService.getSessionLog(active.id);
        setLogs(logData || []);
        
        if (active.status === 'COUNTING') {
          setSessionStep('close_counting');
        } else {
          setSessionStep('active');
        }
      } else {
        setSessionStep('idle');
      }
    } catch (err: any) {
      console.error(err);
      toast.error('Error al cargar la sesión: ' + (err.message || 'Error desconocido'));
    } finally {
      setLoading(false);
    }
  }, [selectedRegister]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

  const expectedNIO = session?.initialAmountNIO 
    ? Number(session.initialAmountNIO) + 
      logs.filter(l => (l.type === 'SALE' || l.type === 'ENTRY') && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountNIO || 0), 0) -
      logs.filter(l => l.type === 'EXIT' && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountNIO || 0), 0)
    : 0;

  const expectedUSD = session?.initialAmountUSD 
    ? Number(session.initialAmountUSD) + 
      logs.filter(l => (l.type === 'SALE' || l.type === 'ENTRY') && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountUSD || 0), 0) -
      logs.filter(l => l.type === 'EXIT' && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountUSD || 0), 0)
    : 0;

  const openSession = async (dto: any) => {
    await cajaService.openSession(dto);
    await loadSessionData();
  };

  const addMovement = async (dto: any) => {
    if (!session) return;
    await cajaService.addMovement(session.id, dto);
    await loadSessionData();
  };

  const savePartialCount = async (dto: any) => {
    if (!session) return;
    await cajaService.countSession(session.id, dto);
    await loadSessionData();
  };

  const closeSession = async (dto: any) => {
    if (!session) return;
    await cajaService.closeSession(session.id, dto);
    await loadSessionData();
  };

  return {
    session,
    logs,
    loading,
    sessionStep,
    setSessionStep,
    expectedNIO,
    expectedUSD,
    refreshSession: loadSessionData,
    openSession,
    addMovement,
    savePartialCount,
    closeSession
  };
}
