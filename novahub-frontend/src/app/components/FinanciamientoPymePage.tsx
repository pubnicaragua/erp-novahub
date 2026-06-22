import {
  ClipboardList,
  FileText,
  Landmark,
  SearchCheck,
  WalletCards,
} from 'lucide-react';
import { Badge } from './ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card';

const processSections = [
  {
    title: 'Solicitud',
    description: 'Sección prevista para capturar la información de una solicitud de financiamiento.',
    icon: ClipboardList,
  },
  {
    title: 'Documentación',
    description: 'Espacio preparado para organizar los requisitos y archivos de respaldo.',
    icon: FileText,
  },
  {
    title: 'Seguimiento',
    description: 'Vista destinada a consultar el estado del proceso cuando exista una fuente de datos.',
    icon: SearchCheck,
  },
];

export function FinanciamientoPymePage() {
  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1700px] p-6 md:p-10">
        <header className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-3">
            <Landmark className="size-9 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase italic leading-none tracking-tighter sm:text-4xl">
              Financiamiento <span className="text-primary">PYME</span>
            </h1>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
              Gestión y seguimiento de solicitudes empresariales
            </p>
          </div>
        </header>

        <div className="space-y-6">
          <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
            <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div className="max-w-3xl space-y-4">
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  Vista preliminar
                </Badge>
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tight sm:text-2xl">
                    Un solo espacio para el proceso de financiamiento
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                    La interfaz está preparada para reunir solicitudes, documentación y seguimiento sin mostrar información ficticia.
                  </p>
                </div>
              </div>
              <div className="flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                <WalletCards className="size-10 text-primary" />
              </div>
            </CardContent>
          </Card>

          <section>
            <div className="mb-4">
              <h2 className="text-sm font-black uppercase tracking-widest">Estructura del módulo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Áreas previstas para conectar el flujo completo más adelante.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {processSections.map((section) => (
                <Card key={section.title} className="border-border/50 bg-card/80 shadow-sm">
                  <CardHeader className="gap-4">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <section.icon className="size-5" />
                    </div>
                    <div className="space-y-2">
                      <CardTitle className="text-sm font-black uppercase tracking-wider">
                        {section.title}
                      </CardTitle>
                      <CardDescription className="text-xs leading-5">
                        {section.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </section>

          <Card className="border-dashed border-border/70 bg-muted/10">
            <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Landmark className="size-7" />
              </div>
              <h2 className="text-base font-black uppercase tracking-wide">Vista sin fuente de datos</h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Esta maqueta no muestra solicitudes. El contenido aparecerá cuando se defina e integre el flujo de financiamiento.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
