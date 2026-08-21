import { useState } from 'react';
import { Printer, ChevronDown } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import type { PaperSize } from '../../hooks/useBrowserPrint';

interface PrintButtonProps {
  onPrint: (paperSize: PaperSize) => void;
  label?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  showDropdown?: boolean;
  includeRoll?: boolean;
}

const PAPER_OPTIONS: { label: string; value: PaperSize; description: string; group: 'standard' | 'roll' }[] = [
  { label: 'Carta', value: 'letter', description: '8.5" × 11"', group: 'standard' },
  { label: 'Oficio', value: 'oficio', description: '8.5" × 13"', group: 'standard' },
  { label: 'A4', value: 'A4', description: '210mm × 297mm', group: 'standard' },
  { label: 'Legal', value: 'legal', description: '8.5" × 14"', group: 'standard' },
  { label: 'Rollo 80mm', value: 'roll-80', description: 'Papel continuo', group: 'roll' },
  { label: 'Rollo 58mm', value: 'roll-58', description: 'Papel continuo', group: 'roll' },
];

export function PrintButton({
  onPrint,
  label = 'Imprimir',
  className,
  variant = 'outline',
  size = 'sm',
  disabled = false,
  showDropdown = true,
  includeRoll = false,
}: PrintButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!showDropdown) {
    return (
      <Button
        variant={variant}
        size={size}
        data-toolbar-role="print"
        className={cn('gap-1.5', className)}
        disabled={disabled}
        onClick={() => onPrint('letter')}
      >
        <Printer className="size-4" />
        <span className="hidden sm:inline">{label}</span>
      </Button>
    );
  }

  const standardOptions = PAPER_OPTIONS.filter((o) => o.group === 'standard');
  const rollOptions = PAPER_OPTIONS.filter((o) => o.group === 'roll');
  const visibleOptions = includeRoll ? PAPER_OPTIONS : standardOptions;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          data-toolbar-role="print"
          className={cn('gap-1.5', className)}
          disabled={disabled}
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">{label}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {includeRoll ? (
          <>
            {standardOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onPrint(option.value)}
                className="flex items-center justify-between gap-3"
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-[10px] text-muted-foreground">{option.description}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            {rollOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => onPrint(option.value)}
                className="flex items-center justify-between gap-3"
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-[10px] text-muted-foreground">{option.description}</span>
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          visibleOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onPrint(option.value)}
              className="flex items-center justify-between gap-3"
            >
              <span className="font-medium">{option.label}</span>
              <span className="text-[10px] text-muted-foreground">{option.description}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
