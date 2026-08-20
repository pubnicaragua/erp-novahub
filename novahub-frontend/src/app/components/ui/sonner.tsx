import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="system"
      className="toaster group erp-toaster"
      style={
        {
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
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
