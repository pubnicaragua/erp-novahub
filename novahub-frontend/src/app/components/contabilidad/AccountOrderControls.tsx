import type { DragEvent, KeyboardEvent } from 'react';
import { GripVertical } from 'lucide-react';
import { setActiveDraggedAccountId } from './useAccountingAccountOrder';

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
    setActiveDraggedAccountId(accountId);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
    event.preventDefault();
    const nextIndex = index + (event.key === 'ArrowUp' ? -1 : 1);
    if (nextIndex >= 0 && nextIndex < accountIds.length) onMoveIndex(index, nextIndex);
  };

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label={`Orden de ${accountName}`}>
      <button
        type="button"
        draggable
        onDragStart={startDrag}
        onDragEnd={() => setActiveDraggedAccountId(null)}
        onKeyDown={handleKeyDown}
        aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown"
        title={`Arrastrar para reordenar ${accountName}. También puedes usar Alt + ↑/↓.`}
        aria-label={`Arrastrar para reordenar ${accountName}. Atajo: Alt más flecha arriba o abajo.`}
        className="inline-flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-muted active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <GripVertical className="size-3.5" />
      </button>
    </span>
  );
}
