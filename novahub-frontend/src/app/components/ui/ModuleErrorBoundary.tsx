import React from 'react';
import * as Sentry from '@sentry/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './button';

interface Props {
  children: React.ReactNode;
  moduleName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ModuleErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ModuleErrorBoundary:${this.props.moduleName || 'module'}]`, error, info.componentStack);
    Sentry.captureException(error, {
      tags: { boundary: 'module', module: this.props.moduleName || 'module' },
      contexts: { react: { componentStack: info.componentStack || 'unknown' } },
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto size-14 rounded-2xl bg-rose-500/10 flex items-center justify-center">
              <AlertTriangle className="size-7 text-rose-500" />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">
                Error en {this.props.moduleName || 'módulo'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Ocurrió un error inesperado. Puedes intentar recargar o contactar a soporte.
              </p>
            </div>
            {this.state.error && (
              <pre className="max-h-24 overflow-auto rounded-xl bg-muted/50 p-3 text-[10px] text-left text-muted-foreground font-mono border">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={this.handleRetry} className="gap-2">
                <RefreshCw className="size-4" /> Reintentar
              </Button>
              <Button onClick={() => window.location.reload()} className="gap-2">
                <RefreshCw className="size-4" /> Recargar página
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
