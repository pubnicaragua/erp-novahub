import * as React from "react";

import { cn } from "./utils";
import { resolveNumberInputStep } from "../../utils/inputStep";
import { DateField } from "./DateField";
import { DateTimePickerField } from "./DateTimePickerField";
import { MonthField } from "./MonthField";

type InputProps = React.ComponentProps<"input"> & { currencyPrecision?: boolean; clearable?: boolean };

type SharedDateInputProps = {
  props: InputProps;
  type: 'date' | 'datetime-local' | 'month';
  forwardedRef: React.ForwardedRef<HTMLInputElement>;
};

function createInputChangeEvent(value: string, name?: string, id?: string) {
  const target = { value, name: name || '', id: id || '' } as HTMLInputElement;
  return { target, currentTarget: target } as unknown as React.ChangeEvent<HTMLInputElement>;
}

function createInputBlurEvent(value: string, name?: string, id?: string) {
  const target = { value, name: name || '', id: id || '' } as HTMLInputElement;
  return { target, currentTarget: target } as unknown as React.FocusEvent<HTMLInputElement>;
}

function SharedDateInput({ props, type, forwardedRef }: SharedDateInputProps) {
  const {
    className,
    value,
    defaultValue,
    onChange,
    onBlur,
    onClick,
    onFocus,
    onKeyDown,
    onKeyUp,
    onWheel,
    onInvalid,
    id,
    name,
    form,
    title,
    placeholder,
    disabled,
    readOnly,
    required,
    min,
    max,
    step,
    autoFocus,
    style,
    currencyPrecision: _currencyPrecision,
    ...rest
  } = props;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => String(value ?? defaultValue ?? ''));
  const currentValue = String(value !== undefined ? value ?? '' : uncontrolledValue);
  const dateValue = type === 'date' && currentValue.includes('T') ? currentValue.slice(0, 10) : currentValue;
  const dataProps = Object.fromEntries(
    Object.entries(rest as Record<string, unknown>).filter(([key]) => key.startsWith('data-'))
  );
  const buttonProps = {
    ...dataProps,
    'data-slot': 'input',
    autoFocus,
    style,
    onClick: onClick ? (event: React.MouseEvent<HTMLButtonElement>) => onClick(event as unknown as React.MouseEvent<HTMLInputElement>) : undefined,
    onFocus: onFocus ? (event: React.FocusEvent<HTMLButtonElement>) => onFocus(event as unknown as React.FocusEvent<HTMLInputElement>) : undefined,
    onKeyDown: onKeyDown ? (event: React.KeyboardEvent<HTMLButtonElement>) => onKeyDown(event as unknown as React.KeyboardEvent<HTMLInputElement>) : undefined,
    onKeyUp: onKeyUp ? (event: React.KeyboardEvent<HTMLButtonElement>) => onKeyUp(event as unknown as React.KeyboardEvent<HTMLInputElement>) : undefined,
    onWheel: onWheel ? (event: React.WheelEvent<HTMLButtonElement>) => onWheel(event as unknown as React.WheelEvent<HTMLInputElement>) : undefined,
  } as React.ButtonHTMLAttributes<HTMLButtonElement> & Record<string, unknown>;
  const notifyChange = (nextValue: string) => {
    if (value === undefined) setUncontrolledValue(nextValue);
    onChange?.(createInputChangeEvent(nextValue, name, id));
    onBlur?.(createInputBlurEvent(nextValue, name, id));
  };
  const normalizedMin = typeof min === 'string' ? min : undefined;
  const normalizedMax = typeof max === 'string' ? max : undefined;
  const dateTimeStep = typeof step === 'number' ? step : Number(step || 60);
  const minuteStep = Number.isFinite(dateTimeStep) && dateTimeStep >= 60 ? Math.floor(dateTimeStep / 60) : 1;

  if (type === 'month') {
    return (
      <MonthField
        value={currentValue}
        onChange={notifyChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled || readOnly}
        minMonth={normalizedMin}
        maxMonth={normalizedMax}
        id={id}
        title={title}
        ariaLabel={props['aria-label']}
        ariaRequired={required || props['aria-required'] === true || props['aria-required'] === 'true'}
        ariaInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
        ariaDescribedBy={props['aria-describedby']}
        name={name}
        form={form}
        required={required}
        clearable={props.clearable ?? true}
        buttonRef={forwardedRef as unknown as React.Ref<HTMLButtonElement>}
        buttonProps={buttonProps}
        onInvalid={onInvalid}
      />
    );
  }

  if (type === 'datetime-local') {
    return (
      <DateTimePickerField
        value={currentValue}
        onChange={notifyChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled || readOnly}
        minDate={normalizedMin}
        maxDate={normalizedMax}
        id={id}
        title={title}
        ariaLabel={props['aria-label']}
        ariaRequired={required || props['aria-required'] === true || props['aria-required'] === 'true'}
        ariaInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
        ariaDescribedBy={props['aria-describedby']}
        name={name}
        form={form}
        required={required}
        buttonRef={forwardedRef as unknown as React.Ref<HTMLButtonElement>}
        buttonProps={buttonProps}
        onInvalid={onInvalid}
        minuteStep={minuteStep}
      />
    );
  }

  return (
    <DateField
      value={dateValue}
      onChange={notifyChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled || readOnly}
      minDate={normalizedMin}
      maxDate={normalizedMax}
      id={id}
      title={title}
      ariaLabel={props['aria-label']}
      ariaRequired={required || props['aria-required'] === true || props['aria-required'] === 'true'}
      ariaInvalid={props['aria-invalid'] === true || props['aria-invalid'] === 'true'}
      ariaDescribedBy={props['aria-describedby']}
      name={name}
      form={form}
      required={required}
      clearable={props.clearable ?? true}
      buttonRef={forwardedRef as unknown as React.Ref<HTMLButtonElement>}
      buttonProps={buttonProps}
      onInvalid={onInvalid}
    />
  );
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onClick, onWheel, currencyPrecision, clearable, step, ...props }, ref) => {
    if (type === 'date' || type === 'datetime-local' || type === 'month') {
      return <SharedDateInput type={type} props={{ className, type, onClick, onWheel, currencyPrecision, clearable, step, ...props }} forwardedRef={ref} />;
    }

    const opensNativePicker = type === 'date'
      || type === 'datetime-local'
      || type === 'month'
      || type === 'time'
      || type === 'week';

    return (
      <input
        type={type}
        ref={ref}
        data-slot="input"
        step={resolveNumberInputStep(type, step, currencyPrecision)}
          className={cn(
          "file:text-foreground placeholder:text-foreground/65 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-border flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]",
          "focus-visible:border-primary focus-visible:ring-primary/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          opensNativePicker && "cursor-pointer",
          className,
        )}
        onClick={(event) => {
          onClick?.(event);
          if (!opensNativePicker || event.currentTarget.disabled || event.currentTarget.readOnly) return;
          try {
            event.currentTarget.showPicker?.();
          } catch {
            // Older browsers open the native picker automatically on click.
          }
        }}
        onWheel={(event) => {
          // A focused number input uses the wheel as a spinner in Chromium and
          // Firefox. Blur it first so scrolling never changes a captured value.
          if (type === 'number' && document.activeElement === event.currentTarget) {
            event.currentTarget.blur();
          }
          onWheel?.(event);
        }}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
