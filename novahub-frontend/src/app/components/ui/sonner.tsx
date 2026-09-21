import { useEffect, useState } from "react";
import { Toaster as Sonner, useSonner, type ToasterProps } from "sonner";

const getAppTheme = (): 'light' | 'dark' =>
  typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light';

const Toaster = ({ className, style, toastOptions, visibleToasts, ...props }: ToasterProps) => {
  const { toasts } = useSonner();
  const [theme, setTheme] = useState(getAppTheme);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setTheme(getAppTheme());
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    syncTheme();
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      {...props}
      theme={theme}
      expand
      closeButton
      toastOptions={{
        ...toastOptions,
        closeButton: true,
        closeButtonAriaLabel: 'Cerrar notificación',
      }}
      visibleToasts={Math.max(3, visibleToasts || 0, toasts.length)}
      className={['toaster', 'group', 'erp-toaster', className].filter(Boolean).join(' ')}
      style={{
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "oklch(0.92 0.05 155)",
          "--success-text": "oklch(0.25 0.08 155)",
          "--success-border": "oklch(0.75 0.1 155)",
          "--error-bg": "oklch(0.92 0.05 25)",
          "--error-text": "oklch(0.25 0.08 25)",
          "--error-border": "oklch(0.75 0.1 25)",
          "--warning-bg": "oklch(0.92 0.05 80)",
          "--warning-text": "oklch(0.25 0.08 80)",
          "--warning-border": "oklch(0.75 0.1 80)",
          "--info-bg": "oklch(0.92 0.05 250)",
          "--info-text": "oklch(0.25 0.08 250)",
          "--info-border": "oklch(0.75 0.1 250)",
          ...style,
        } as React.CSSProperties}
    />
  );
};

export { Toaster };
