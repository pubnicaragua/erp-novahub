import { useState } from 'react';
import { History } from 'lucide-react';
import { Button } from '../ui/button';
import { AuditHistoryModal } from '../ui/AuditHistoryModal';

interface PurchaseAuditButtonProps {
  entity: string;
  entityId: string;
  title?: string;
}

export function PurchaseAuditButton({ entity, entityId, title = 'Historial de Auditoria' }: PurchaseAuditButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        title="Auditoria"
        variant="ghost"
        size="icon"
        className="size-8 rounded-lg hover:bg-amber-500/10 hover:text-amber-500"
        onClick={() => setOpen(true)}
      >
        <History className="size-4" />
      </Button>
      <AuditHistoryModal
        isOpen={open}
        onClose={() => setOpen(false)}
        entity={entity}
        entityId={entityId}
        title={title}
      />
    </>
  );
}
