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
  if (documentPhone) return normalizeWhatsAppPhone(documentPhone);

  const catalogPhone = String(customers.find((entry) => entry.id === customerId)?.phone || '').trim();
  return normalizeWhatsAppPhone(catalogPhone);
}

/** WhatsApp solo recibe el teléfono persistido en E.164; nunca se adivina un país. */
export function normalizeWhatsAppPhone(value: string | null | undefined): string | null {
  const raw = String(value || '').trim();
  if (!raw.startsWith('+')) return null;
  const digits = raw.replace(/\D/g, '');
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

export function buildCustomerWhatsAppUrl(phone: string | null | undefined, message?: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
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
