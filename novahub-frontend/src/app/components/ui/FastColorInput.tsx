import { useEffect, useRef, type FormEvent, type InputHTMLAttributes } from 'react';

type FastColorInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'defaultValue' | 'onChange' | 'onInput'
> & {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function normalizeColor(value: string) {
  return HEX_COLOR.test(value) ? value : '#000000';
}

/**
 * Selector de color no controlado durante la interacción.
 *
 * Los selectores nativos pueden emitir muchos eventos mientras se mueve el
 * cursor dentro del picker. Mantenerlos controlados obliga a React a
 * reconstruir todo el canvas en cada evento. Este componente mantiene el
 * input local y confirma el último valor después de una pausa breve.
 */
export function FastColorInput({ value, onChange, debounceMs = 90, onBlur, ...props }: FastColorInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(normalizeColor(value));
  const callbackRef = useRef(onChange);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    callbackRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const nextValue = normalizeColor(value);
    valueRef.current = nextValue;
    // No pisar el valor local mientras el picker está abierto.
    if (document.activeElement !== inputRef.current && inputRef.current && inputRef.current.value !== nextValue) {
      inputRef.current.value = nextValue;
    }
  }, [value]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    callbackRef.current(valueRef.current);
  };

  const schedule = (event: FormEvent<HTMLInputElement>) => {
    valueRef.current = normalizeColor(event.currentTarget.value);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, debounceMs);
  };

  return (
    <input
      {...props}
      ref={inputRef}
      type="color"
      defaultValue={valueRef.current}
      onChange={schedule}
      onInput={schedule}
      onBlur={event => {
        flush();
        onBlur?.(event);
      }}
    />
  );
}
