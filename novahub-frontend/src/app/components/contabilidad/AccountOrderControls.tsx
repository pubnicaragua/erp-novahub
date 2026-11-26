import type { DragEvent } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Button } from '../ui/button';

export function AccountOrderControls({
  accountId,
  accountName,
  accountIds,
  onMoveIndex,
}: {
  accountId: string;
  accountName: string;
  accountIds: string[];
  onMoveIndex: (fromIndex: number, toIndex: number) => void;
}) {
  const index = accountIds.indexOf(accountId);
  if (index < 0) return null;

  const startDrag = (event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', accountId);
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`Orden de ${accountName}`}>
      <button
        type="button"
        draggable
        onDragStart={startDrag}
        title={`Arrastrar para reordenar ${accountName}`}
        aria-label={`Arrastrar para reordenar ${accountName}`}
        className="inline-flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <GripVertical className="size-3.5" />
      </button>
      <Button type="button" variant="ghost" size="icon" className="size-6" disabled={index === 0} onClick={() => onMoveIndex(index, index - 1)} title={`Subir ${accountName}`} aria-label={`Subir ${accountName}`}>
        <ArrowUp className="size-3.5" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className="size-6" disabled={index === accountIds.length - 1} onClick={() => onMoveIndex(index, index + 1)} title={`Bajar ${accountName}`} aria-label={`Bajar ${accountName}`}>
        <ArrowDown className="size-3.5" />
      </Button>
    </span>
  );
}
