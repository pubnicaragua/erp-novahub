import { useCallback, useEffect, useRef, useState } from 'react';

/** Gives list/card detail panels an immediate, short-lived opening state. */
export function useDetailOpeningFeedback() {
  const [openingId, setOpeningId] = useState<string | number | null>(null);
  const timerRef = useRef<number | null>(null);

  const startOpening = useCallback((id: string | number, action: () => void) => {
    setOpeningId(id);
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    action();
    timerRef.current = window.setTimeout(() => {
      setOpeningId((current) => String(current) === String(id) ? null : current);
      timerRef.current = null;
    }, 900);
  }, []);

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
  }, []);

  return { openingId, startOpening };
}
