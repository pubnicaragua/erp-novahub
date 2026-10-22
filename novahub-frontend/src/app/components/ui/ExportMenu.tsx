import { ChevronDown, Download, FileSpreadsheet, FileText, ReceiptText } from 'lucide-react';
import { Button } from './button';
import { cn } from './utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './dropdown-menu';
import { PDF_DOWNLOAD_OPTIONS, type PdfPaperFormat } from '../../utils/pdfDownloadFormats';

export interface ExportMenuProps {
  onPdf?: (format: PdfPaperFormat) => void;
  onExcel?: () => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  size?: 'default' | 'sm' | 'lg';
  pdfLabel?: string;
  excelLabel?: string;
  pdfDescription?: string;
  excelDescription?: string;
}

/** Menú común para salidas lógicas de una vista. Los botones especializados
 * de tickets/rollos siguen usando su renderer físico separado. */
export function ExportMenu({ onPdf, onExcel, disabled = false, className, label = 'Exportar', size = 'sm', pdfLabel = 'Exportar PDF', excelLabel = 'Exportar Excel', excelDescription = 'Todos los registros filtrados' }: ExportMenuProps) {
  const hasPdf = Boolean(onPdf);
  const hasExcel = Boolean(onExcel);
  if (!hasPdf && !hasExcel) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size={size} disabled={disabled} className={cn('gap-1.5 rounded-xl', className)} aria-label={`${label} PDF o Excel`}>
          <Download className="size-4 shrink-0 text-primary" />
          <span>{label}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(80vh,34rem)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl p-1.5">
        {hasPdf && <>
          <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75"><FileText className="size-3.5 text-rose-600" />{pdfLabel}</DropdownMenuLabel>
          {PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'standard').map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => onPdf?.(option.value)} className="gap-2.5 rounded-xl py-2">
              <Download className="size-3.5 text-primary" />
              <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
              <span className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-muted-foreground">{option.dimensions}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1.5 text-[9px] uppercase tracking-[0.16em] text-popover-foreground/75"><ReceiptText className="size-3.5" />Rollos / Voucher</DropdownMenuLabel>
          {PDF_DOWNLOAD_OPTIONS.filter((option) => option.group === 'roll').map((option) => (
            <DropdownMenuItem key={option.value} onClick={() => onPdf?.(option.value)} className="gap-2.5 rounded-xl py-2">
              <ReceiptText className="size-3.5 text-primary" />
              <span className="min-w-0 flex-1 truncate font-medium">{option.name}</span>
              <span className="shrink-0 whitespace-nowrap text-right text-[11px] tabular-nums text-muted-foreground">{option.dimensions}</span>
            </DropdownMenuItem>
          ))}
        </>}
        {hasPdf && hasExcel && <DropdownMenuSeparator />}
        {hasExcel && <DropdownMenuItem onClick={onExcel} className="gap-2 rounded-xl py-2.5">
          <FileSpreadsheet className="size-4 text-emerald-600" />
          <span className="min-w-0 flex-1"><span className="block font-bold">{excelLabel}</span><span className="block text-[10px] text-popover-foreground/75">{excelDescription}</span></span>
        </DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

