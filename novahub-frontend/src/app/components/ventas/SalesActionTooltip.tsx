import type { ReactElement, ReactNode } from 'react';
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
