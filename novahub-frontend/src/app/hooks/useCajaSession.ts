import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { cajaService, CashRegisterSession, SessionLog, CashRegisterCount, CashClosureMode } from '../services/caja.service';
import { getApiErrorMessage } from '../services/api';

export type SessionStep = 'idle' | 'active' | 'close_counting';

export function useCajaSession(selectedRegister: string) {
  const [session, setSession] = useState<CashRegisterSession | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionStep, setSessionStep] = useState<SessionStep>('idle');
  const [closureMode, setClosureMode] = useState<CashClosureMode>('NORMAL');
  const [countAttempts, setCountAttempts] = useState<CashRegisterCount[]>([]);

  const loadSessionData = useCallback(async () => {
    if (!selectedRegister) return;

    setLoading(true);
    setSession(null);
    setLogs([]);
    setSessionStep('idle');
    setClosureMode('NORMAL');
    setCountAttempts([]);

    try {
      const active = await cajaService.getActiveSession(selectedRegister);
      setSession(active || null);
      if (active) {
        const mode = active.closureMode || 'NORMAL';
        const attempts = active.countAttempts || [];
        setClosureMode(mode);
        setCountAttempts(attempts);
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
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'Error al cargar la sesion de caja'));
    } finally {
      setLoading(false);
    }
  }, [selectedRegister]);

  useEffect(() => {
    const load = async () => {
      if (!selectedRegister) return;
      setLoading(true);
      await loadSessionData();
    };
    load();
  }, [loadSessionData, selectedRegister]);

  const expectedNIO = session
    ? Number(session.initialAmountNIO || 0) +
      logs.filter(l => (l.type === 'SALE' || l.type === 'ENTRY') && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountNIO || 0), 0) -
      logs.filter(l => l.type === 'EXIT' && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountNIO || 0), 0)
    : 0;

  const expectedUSD = session
    ? Number(session.initialAmountUSD || 0) +
      logs.filter(l => (l.type === 'SALE' || l.type === 'ENTRY') && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountUSD || 0), 0) -
      logs.filter(l => l.type === 'EXIT' && (!l.paymentMethod || l.paymentMethod === 'CASH')).reduce((acc, l) => acc + Number(l.amountUSD || 0), 0)
    : 0;

  const resolvedExpectedNIO = closureMode === 'BLIND' && countAttempts.length > 0
    ? Number(countAttempts[countAttempts.length - 1].expectedAmountNIO || 0)
    : expectedNIO;
  const resolvedExpectedUSD = closureMode === 'BLIND' && countAttempts.length > 0
    ? Number(countAttempts[countAttempts.length - 1].expectedAmountUSD || 0)
    : expectedUSD;

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
    const result = await cajaService.countSession(session.id, dto);
    await loadSessionData();
    return result;
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
    closureMode,
    countAttempts,
    lastCountResult: countAttempts[countAttempts.length - 1] || null,
    expectedNIO: resolvedExpectedNIO,
    expectedUSD: resolvedExpectedUSD,
    refreshSession: loadSessionData,
    openSession,
    addMovement,
    savePartialCount,
    closeSession,
  };
}
