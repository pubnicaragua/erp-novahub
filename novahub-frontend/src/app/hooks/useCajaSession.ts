import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { cajaService, CashRegisterSession, SessionLog } from '../services/caja.service';
import { getApiErrorMessage } from '../services/api';

export type SessionStep = 'idle' | 'active' | 'close_counting';

function calculateExpectedAmount(
  session: CashRegisterSession | null,
  logs: SessionLog[],
  currency: 'NIO' | 'USD'
) {
  const initial = Number(currency === 'NIO' ? session?.initialAmountNIO : session?.initialAmountUSD) || 0;

  return logs.reduce((total, log) => {
    if (log.paymentMethod && log.paymentMethod !== 'CASH') return total;

    const amount = Number(currency === 'NIO' ? log.amountNIO : log.amountUSD) || 0;
    if (log.type === 'SALE' || log.type === 'ENTRY') return total + amount;
    if (log.type === 'EXIT') return total - amount;
    return total;
  }, initial);
}

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

      if (!active) {
        setSessionStep('idle');
        return;
      }

      const logData = await cajaService.getSessionLog(active.id);
      setLogs(logData || []);
      setSessionStep(active.status === 'COUNTING' ? 'close_counting' : 'active');
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'Error al cargar la sesion de caja'));
    } finally {
      setLoading(false);
    }
  }, [selectedRegister]);

  useEffect(() => {
    loadSessionData();
  }, [loadSessionData]);

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
    expectedNIO: calculateExpectedAmount(session, logs, 'NIO'),
    expectedUSD: calculateExpectedAmount(session, logs, 'USD'),
    refreshSession: loadSessionData,
    openSession,
    addMovement,
    savePartialCount,
    closeSession,
  };
}
