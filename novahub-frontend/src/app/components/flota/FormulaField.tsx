import { useState } from 'react';
import { CheckCircle2, CircleHelp, TriangleAlert } from 'lucide-react';
import { Input } from '../ui/input';
import { useTenantQuery } from '../../hooks/useTenantQuery';
import { flotaService, type FormulaCheck } from '../../services/flota.service';
import { errorMessage } from '../organizacion/organizacion.utils';

interface Props {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Campo de fórmula de la empresa: valida contra el servidor al salir del campo y deja insertar las variables
 * disponibles con un clic. La fórmula nunca se ejecuta como código: la evalúa un analizador propio del backend.
 */
export function FormulaField({ id, value, onChange, disabled, placeholder }: Props) {
  const help = useTenantQuery(['fleet', 'formula-help'], (signal) => flotaService.formulaHelp(signal));
  const [check, setCheck] = useState<FormulaCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const validate = async (formula: string) => {
    if (!formula.trim()) { setCheck(null); return; }
    setChecking(true);
    try { setCheck(await flotaService.checkFormula(formula)); }
    catch (error) { setCheck({ ok: false, error: errorMessage(error), variables: [], unknown: [] }); }
    finally { setChecking(false); }
  };

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex items-center gap-2">
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder || help.data?.example || 'km * factor_km / capacidad'}
          className="font-mono text-[13px]"
          aria-invalid={check ? !check.ok : undefined}
          onChange={(event) => { onChange(event.target.value); setCheck(null); }}
          onBlur={() => void validate(value)}
        />
        <button type="button" onClick={() => setShowHelp((open) => !open)} className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground hover:bg-muted" aria-label="Ver variables y funciones disponibles" aria-expanded={showHelp}>
          <CircleHelp className="size-4" aria-hidden="true" />
        </button>
      </div>
      {checking && <p className="text-[12px] text-muted-foreground">Revisando la fórmula…</p>}
      {check?.ok && <p className="flex items-center gap-1 text-[12px] text-success"><CheckCircle2 className="size-3.5" aria-hidden="true" />Fórmula válida.</p>}
      {check && !check.ok && <p className="flex items-center gap-1 text-[12px] text-destructive" role="alert"><TriangleAlert className="size-3.5" aria-hidden="true" />{check.error}</p>}
      {showHelp && help.data && (
        <div className="rounded-xl border border-border bg-muted/20 p-3 text-[12px]">
          <p className="mb-1.5 font-semibold">Variables (clic para insertar)</p>
          <div className="flex flex-wrap gap-1.5">
            {help.data.variables.map((variable) => (
              <button key={variable.name} type="button" disabled={disabled} title={variable.description} onClick={() => { onChange(`${value}${value && !/[\s(+\-*/]$/.test(value) ? ' ' : ''}${variable.name}`); setCheck(null); }} className="rounded-md border bg-background px-1.5 py-0.5 font-mono hover:border-primary hover:text-primary">
                {variable.name}
              </button>
            ))}
          </div>
          <p className="mb-1 mt-3 font-semibold">Funciones</p>
          <p className="font-mono text-muted-foreground">{help.data.functions.join('  ·  ')}</p>
          <p className="mb-1 mt-3 font-semibold">Operadores</p>
          <p className="font-mono text-muted-foreground">{help.data.operators.join('  ')}</p>
          <p className="mt-3 text-muted-foreground">Los decimales llevan punto. Ejemplo: <span className="font-mono">{help.data.example}</span></p>
        </div>
      )}
    </div>
  );
}
