import { Children, Fragment, cloneElement, isValidElement } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from '../ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface SalesActionTooltipProps {
  label: ReactNode;
  children: ReactElement;
}

export function SalesActionTooltip({ label, children }: SalesActionTooltipProps) {
  const isDisabled = Boolean((children.props as { disabled?: boolean }).disabled);
  const trigger = isDisabled
    ? <span tabIndex={0} className="inline-flex">{children}</span>
    : children;

  return (
    <Tooltip delayDuration={60}>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={4} className="max-w-60 text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function getActionText(value: ReactNode): string {
  return Children.toArray(value)
    .map((child) => {
      if (typeof child === 'string' || typeof child === 'number') return String(child);
      if (isValidElement(child)) return getActionText((child.props as { children?: ReactNode }).children);
      return '';
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function describeSalesAction(source: string, documentLabel: string): string {
  const label = source.replace(/\s+/g, ' ').trim();
  const action = label.toLocaleLowerCase('es');
  const document = documentLabel.toLocaleLowerCase('es').trim();
  if (!label || !document) return label || 'Acción';

  // Keep explanations for unavailable actions intact; they tell the user why
  // a disabled control cannot be used.
  if (/no hay|sin tel[eé]fono|selecciona|debe cubrir|disponible debe|no est[aá] disponible/.test(action)) return label;
  if (/whatsapp/.test(action)) return `Enviar ${document} por WhatsApp`;
  if (/caja/.test(action)) {
    if (/crear/.test(action)) return `Crear y enviar ${document} a Caja`;
    if (/aprobar/.test(action) && /orden/.test(action)) return `Aprobar ${document} y crear la orden`;
    if (/aprobar/.test(action)) return `Aprobar ${document} y enviar a Caja`;
    return `Enviar ${document} a Caja`;
  }
  if (/solicitar/.test(action) && /anular|cancelar/.test(action)) return `Enviar solicitud de anulación de ${document}`;
  if (/link/.test(action)) return `Administrar enlaces de pago de ${document}`;
  if (/poket/.test(action)) return `Administrar cobros con Poket de ${document}`;
  if (/cr[eé]dito/.test(action)) return `Enviar ${document} a crédito`;
  if (/facturar|enviar a facturas/.test(action)) return `Facturar ${document}`;
  if (/^ver(?:\s|$)|^abrir(?:\s|$)/.test(action)) return `Abrir ${document}`;
  if (/crear orden/.test(action)) return `Crear una orden a partir de ${document}`;
  if (/imprimir|descargar|exportar pdf/.test(action)) {
    if (/plan|estado de cuenta|comprobante|recibo|ticket/.test(action)) return label;
    return `Imprimir ${document}`;
  }
  if (/anular|cancelar/.test(action)) return `Anular ${document}`;
  if (/desembolsar/.test(action)) return `Desembolsar ${document}`;
  if (/activar|inactivar/.test(action)) return `${label} ${document}`;
  if (/aprobar/.test(action)) return `Aprobar ${document}`;
  if (/pagar|abonar|registrar pago/.test(action)) return `Registrar pago de ${document}`;
  if (/pausar|reanudar/.test(action)) return `${label} ${document}`;
  if (/aplicar/.test(action)) return `Aplicar ${document}`;
  if (/rechazar/.test(action)) return `Rechazar ${document}`;
  if (/eliminar/.test(action)) return `Eliminar ${document}`;
  if (/editar/.test(action)) return `Editar ${document}`;
  if (/^guardar$/.test(action)) return `Guardar ${document} como borrador`;
  return label;
}

interface SalesActionTooltipsProps {
  documentLabel: string;
  children: ReactNode;
}

/** Adds the same quick tooltip to the action buttons in a document action group. */
export function SalesActionTooltips({ documentLabel, children }: SalesActionTooltipsProps) {
  const addTooltips = (nodes: ReactNode): ReactNode => Children.map(nodes, (child) => {
    if (!isValidElement(child)) return child;
    if (child.type === SalesActionTooltip) return child;

    const props = child.props as { children?: ReactNode; 'aria-label'?: string; title?: string };
    if (child.type === Button) {
      const source = props['aria-label'] || props.title || getActionText(props.children);
      return <SalesActionTooltip label={describeSalesAction(source, documentLabel)}>{child as ReactElement}</SalesActionTooltip>;
    }

    // Recurse only through layout elements and fragments. Composite components
    // manage their own actions and should keep their own tooltip behavior.
    if (child.type === Fragment || typeof child.type === 'string') {
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, undefined, addTooltips(props.children));
    }
    return child;
  });

  return <>{addTooltips(children)}</>;
}
