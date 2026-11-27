import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
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
      icons={{
        success: <CheckCircle2 className="size-4 text-emerald-500" aria-hidden="true" />,
        info: <Info className="size-4 text-sky-500" aria-hidden="true" />,
        warning: <AlertTriangle className="size-4 text-amber-500" aria-hidden="true" />,
        error: <XCircle className="size-4 text-rose-500" aria-hidden="true" />,
      }}
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
          ...style,
        } as React.CSSProperties}
    />
  );
};

export { Toaster };
