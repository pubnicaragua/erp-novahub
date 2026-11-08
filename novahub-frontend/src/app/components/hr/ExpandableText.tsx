import { useState } from 'react';
import { cn } from '../ui/utils';

/** Texto largo recortado a unas líneas, con «Ver más» / «Ver menos». Si es corto, se muestra completo y sin botón. */
export function ExpandableText({ text, lines = 3, threshold = 140, className }: { text: string; lines?: 2 | 3 | 4; threshold?: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > threshold || text.split('\n').length > lines;
  const clamp = { 2: 'line-clamp-2', 3: 'line-clamp-3', 4: 'line-clamp-4' }[lines];
  return (
    <div className={className}>
      <p className={cn('whitespace-pre-line break-words text-sm text-muted-foreground', long && !open && clamp)}>{text}</p>
      {long && (
        <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="mt-1 text-xs font-semibold text-primary underline dark:text-accent">
          {open ? 'Ver menos' : 'Ver más'}
        </button>
      )}
    </div>
  );
}
