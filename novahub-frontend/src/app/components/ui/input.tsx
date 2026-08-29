import * as React from "react";

import { cn } from "./utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, ...props }, ref) => {
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
          className={cn(
          "file:text-foreground placeholder:text-foreground/65 selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-border flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base bg-input-background transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm [color-scheme:light] dark:[color-scheme:dark]",
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
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
