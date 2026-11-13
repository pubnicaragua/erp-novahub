import type { ComponentProps, MouseEvent } from 'react';
import { toast } from '../../services/toast';
import { Button } from '../ui/button';
import { cn } from '../ui/utils';

export const SALES_CUSTOMER_REQUIRED_MESSAGE = 'Selecciona un cliente para poder agregar productos, servicios, delivery o costes extra.';

type SalesCustomerActionButtonProps = Omit<ComponentProps<typeof Button>, 'disabled' | 'onClick'> & {
  customerSelected: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function SalesCustomerActionButton({
  customerSelected,
  disabled = false,
  onClick,
  title,
  className,
  ...props
}: SalesCustomerActionButtonProps) {
  const customerRequired = !customerSelected;

  return (
    <Button
      {...props}
      disabled={disabled}
      aria-disabled={disabled || customerRequired}
      title={customerRequired && !disabled ? SALES_CUSTOMER_REQUIRED_MESSAGE : title}
      className={cn(className, customerRequired && !disabled && 'cursor-not-allowed opacity-50')}
      onClick={(event) => {
        if (customerRequired) {
          event.preventDefault();
          toast.info(SALES_CUSTOMER_REQUIRED_MESSAGE);
          return;
        }
        if (!disabled) onClick?.(event);
      }}
    />
  );
}
