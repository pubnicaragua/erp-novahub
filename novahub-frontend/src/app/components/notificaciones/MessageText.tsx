import { Fragment } from 'react';
import { parseMessageText } from './message-text';
import { cn } from '../ui/utils';

interface MessageTextProps {
  content: string;
  mine: boolean;
}

export function MessageText({ content, mine }: MessageTextProps) {
  return <>{parseMessageText(content).map((part, index) => part.href ? (
    <a
      key={`message-link-${index}`}
      href={part.href}
      target="_blank"
      rel="noopener noreferrer"
      referrerPolicy="no-referrer"
      aria-label={`Abrir enlace ${part.text} en una pestaña nueva`}
      className={cn(
        'break-all font-medium underline underline-offset-2 focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        mine ? 'text-primary-foreground' : 'text-primary hover:text-primary/80',
      )}
    >
      {part.text}
    </a>
  ) : <Fragment key={`message-text-${index}`}>{part.text}</Fragment>)}</>;
}
