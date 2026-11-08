import { useEffect, useState } from 'react';

/** Hace un re-render cada 30 segundos para que el contador de una pregunta avance solo. */
export function useMinuteTicker() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}
