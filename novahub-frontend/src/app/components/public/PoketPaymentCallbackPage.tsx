import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { poketPayLinkService, type PoketPayLinkStatus } from '../../services/poket-paylink.service';

export function PoketPaymentCallbackPage() {
  const paymentLinkId = new URLSearchParams(window.location.search).get('paymentLinkId') || '';
  const [status, setStatus] = useState<PoketPayLinkStatus | 'LOADING' | 'ERROR'>(paymentLinkId ? 'LOADING' : 'ERROR');

  useEffect(() => {
    if (!paymentLinkId) return;
    let stopped = false;
    let attempts = 0;
    const maxAttempts = 48;
    const check = async () => {
      try {
        if (attempts === 0 || attempts % 4 === 0) {
          await poketPayLinkService.publicReconcile(paymentLinkId).catch(() => undefined);
        }
        const result = await poketPayLinkService.publicStatus(paymentLinkId);
        if (stopped) return;
        setStatus(result.status);
        if (!['RESOLVED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(result.status) && attempts < maxAttempts) {
          attempts += 1;
          window.setTimeout(() => void check(), 2500);
        } else if (!['RESOLVED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(result.status)) {
          setStatus('ERROR');
        }
      } catch {
        if (!stopped) setStatus('ERROR');
      }
    };
    void check();
    return () => { stopped = true; };
  }, [paymentLinkId]);

  const resolved = status === 'RESOLVED';
  const failed = ['FAILED', 'EXPIRED', 'CANCELLED', 'ERROR'].includes(status);
  return <main className="flex min-h-screen items-center justify-center bg-background px-6"><section className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-8 text-center shadow-xl">{resolved ? <CheckCircle2 className="mx-auto size-14 text-emerald-600" /> : failed ? <XCircle className="mx-auto size-14 text-rose-600" /> : <Loader2 className="mx-auto size-14 animate-spin text-primary" />}<h1 className="mt-5 text-2xl font-black">{resolved ? 'Pago confirmado' : failed ? 'No pudimos confirmar el pago' : 'Confirmando pago...'}</h1><p className="mt-3 text-sm text-muted-foreground">{resolved ? 'NovaHub ya registró el pago y actualizó la factura.' : failed ? 'Puedes cerrar esta ventana o contactar a la empresa para verificar el estado.' : 'Estamos consultando a NovaHub. No cierres esta ventana todavía.'}</p></section></main>;
}
