import { ChevronDown, Download, ReceiptText } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { PDF_DOWNLOAD_OPTIONS, type PdfDownloadFormat } from '../../utils/pdfDownloadFormats';

interface PdfDownloadButtonProps {
  onDownload: (format: PdfDownloadFormat) => void;
  className?: string;
  disabled?: boolean;
  size?: 'default' | 'sm' | 'lg';
  includeRoll?: boolean;
  label?: string;
  standardLabel?: string;
  standardDescription?: string;
  showStandardOptions?: boolean;
  firstOption?: {
    label: string;
    description?: string;
    onSelect: () => void;
  };
}

/** Menú único para previsualizar una transacción sin ofrecer reportes de la tabla. */
export function PdfDownloadButton({ onDownload, className, disabled = false, size = 'sm', includeRoll = true, label = 'Descargar', standardLabel = 'PDF normal', standardDescription = 'Diseño asignado o global', showStandardOptions = true, firstOption }: PdfDownloadButtonProps) {
  const standardOptions = showStandardOptions ? PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'standard') : [];
  const rollOptions = includeRoll ? PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'roll') : [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled} className={cn('group gap-1.5 rounded-xl', className)}>
          <Download className="size-4 shrink-0 text-primary transition-colors group-hover:text-foreground" />
          <span>{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-2xl p-1.5">
        {firstOption && <DropdownMenuItem onClick={firstOption.onSelect} className="gap-2 rounded-xl py-2.5 [&_svg]:text-foreground/80 data-[highlighted]:[&_svg]:!text-primary-foreground">
          <Download className="size-4" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{firstOption.label}</span>
            {firstOption.description && <span className="block text-[10px] text-popover-foreground/75">{firstOption.description}</span>}
          </span>
        </DropdownMenuItem>}
        {firstOption && showStandardOptions && <DropdownMenuSeparator />}
        {showStandardOptions && <DropdownMenuItem onClick={() => onDownload('configured')} className="gap-2 rounded-xl py-2.5 [&_svg]:text-foreground/80 data-[highlighted]:[&_svg]:!text-primary-foreground">
          <Download className="size-4" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{standardLabel}</span>
            <span className="block text-[10px] text-popover-foreground/75">{standardDescription}</span>
          </span>
        </DropdownMenuItem>}
        {showStandardOptions && <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">Tamaños de página</DropdownMenuLabel>
          {standardOptions.map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => onDownload(option.value)} className="gap-2 rounded-xl py-2 [&_svg]:text-foreground/70 data-[highlighted]:[&_svg]:!text-primary-foreground">
              <Download className="size-3.5" />
              <span className="min-w-0 flex-1 font-medium">{option.label}</span>
              <span className="text-right text-[10px] leading-tight text-popover-foreground/75">{option.description}</span>
            </DropdownMenuItem>
          ))}
        </>}
        {rollOptions.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75">
              <ReceiptText className="size-3.5" /> Rollos / Voucher
            </DropdownMenuLabel>
            {rollOptions.map((option) => (
              <DropdownMenuItem key={option.value} onClick={() => onDownload(option.value)} className="gap-2 rounded-xl py-2 [&_svg]:text-primary data-[highlighted]:[&_svg]:!text-primary-foreground">
                <ReceiptText className="size-3.5" />
                <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                <span className="text-right text-[10px] leading-tight text-popover-foreground/75">{option.description}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
