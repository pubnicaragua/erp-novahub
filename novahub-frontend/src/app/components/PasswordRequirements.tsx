import { CheckCircle2, Circle } from "lucide-react";
import { passwordRules } from "../utils/accountValidation";
import { cn } from "./ui/utils";

type PasswordRequirementsProps = {
  value: string;
  className?: string;
  required?: boolean;
};

export function PasswordRequirements({ value, className, required = true }: PasswordRequirementsProps) {
  const normalizedValue = String(value ?? "");
  const completed = passwordRules.filter((rule) => rule.test(normalizedValue)).length;
  const isComplete = completed === passwordRules.length;
  const isOptionalEmpty = !required && normalizedValue.length === 0;

  return (
    <div
      className={cn(
        "mt-2 rounded-xl border border-border/70 bg-muted/20 p-3",
        className,
      )}
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          Requisitos de seguridad{required ? "" : " (si la cambias)"}
        </p>
        <span
          className={cn(
            "text-[10px] font-bold",
            isComplete ? "text-emerald-600" : "text-muted-foreground",
          )}
        >
          {isOptionalEmpty ? "Sin cambios" : `${completed}/${passwordRules.length} cumplidos`}
        </span>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {passwordRules.map((rule) => {
          const passed = rule.test(normalizedValue);
          return (
            <p
              key={rule.label}
              className={cn(
                "flex items-center gap-1.5 text-[11px] transition-colors",
                passed ? "text-emerald-600" : "text-muted-foreground",
              )}
            >
              {passed ? (
                <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{rule.label}</span>
            </p>
          );
        })}
      </div>
    </div>
  );
}
