import { useEffect, useState } from 'react';

/** Waits for a short pause before recalculating work driven by rapidly edited fields. */
export function useDebouncedValue<T>(value: T, delayMs = 180): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debouncedValue;
}
