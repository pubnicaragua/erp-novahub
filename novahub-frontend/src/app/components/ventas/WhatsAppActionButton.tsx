import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import type { Customer } from '../../types';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

interface WhatsAppActionButtonProps {
  phone?: string | null;
  documentLabel: string;
  onSend: () => Promise<void> | void;
}

export function resolveCustomerPhone(
  customerId: string | null | undefined,
  customer: Pick<Customer, 'phone'> | null | undefined,
  customers: Customer[] = [],
) {
  const documentPhone = String(customer?.phone || '').trim();
  if (documentPhone) return documentPhone;

  const catalogPhone = String(customers.find((entry) => entry.id === customerId)?.phone || '').trim();
  return catalogPhone || null;
}

export function WhatsAppActionButton({ phone, documentLabel, onSend }: WhatsAppActionButtonProps) {
  const hasPhone = Boolean(String(phone || '').trim());
  const actionLabel = hasPhone
    ? `Enviar ${documentLabel} por WhatsApp`
    : `Cliente sin número asociado para enviar ${documentLabel} por WhatsApp`;

  return (
    <Button
      type="button"
      title={actionLabel}
      aria-label={actionLabel}
      data-whatsapp-action="true"
      variant="ghost"
      size="icon"
      className={cn(
        'relative z-20 size-8 shrink-0 rounded-lg transition-colors',
        hasPhone
          ? 'text-emerald-600/70 hover:bg-emerald-500/10 hover:text-emerald-600 dark:text-emerald-400/70 dark:hover:text-emerald-300'
          : 'text-muted-foreground/35 hover:bg-muted/40 hover:text-muted-foreground/60',
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!hasPhone) {
          toast.error(`El cliente no tiene un número asociado para enviar la ${documentLabel} por WhatsApp`);
          return;
        }
        void onSend();
      }}
    >
      <WhatsAppIcon
        fontSize="inherit"
        className="size-4"
        style={{ width: '1rem', height: '1rem', fontSize: '1rem' }}
        aria-hidden="true"
      />
    </Button>
  );
}
