import { useState } from 'react';
import { Printer, ChevronDown, FileText, ReceiptText } from 'lucide-react';
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
import { PDF_DOWNLOAD_OPTIONS } from '../../utils/pdfDownloadFormats';

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

export function PrintButton({
  onPrint,
  label = 'Imprimir',
  className,
  variant = 'outline',
  size = 'sm',
  disabled = false,
  showDropdown = true,
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

  const standardOptions = PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'standard');
  const rollOptions = PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'roll');

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
      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)]">
        <>
          {standardOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onPrint(option.value)}
              className="gap-2.5 rounded-xl py-2"
            >
              <FileText className="size-3.5 text-primary" />
              <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
              <span className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-muted-foreground">{option.dimensions}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {rollOptions.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onPrint(option.value as PaperSize)}
              className="gap-2.5 rounded-xl py-2"
            >
              <ReceiptText className="size-3.5 text-primary" />
              <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
              <span className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-muted-foreground">{option.dimensions}</span>
            </DropdownMenuItem>
          ))}
        </>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
