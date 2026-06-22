import {
  FileCheck2,
  FileText,
  MessageSquareText,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '../ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';

const serviceAreas = [
  {
    title: 'Consultas',
    description: 'Espacio previsto para registrar y dar contexto a cada solicitud legal.',
    icon: MessageSquareText,
  },
  {
    title: 'Documentación',
    description: 'Área destinada a reunir los archivos relacionados con cada consulta.',
    icon: FileText,
  },
  {
    title: 'Seguimiento',
    description: 'Vista preparada para consultar avances y respuestas cuando exista integración.',
    icon: FileCheck2,
  },
];

export function AsesoriaLegalView() {
  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
        <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
          <div className="max-w-3xl space-y-4">
            <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
              Vista preliminar
            </Badge>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tight sm:text-3xl">
                Asesoría <span className="text-primary">Legal</span>
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Un espacio de ayuda para centralizar consultas, documentación y seguimiento legal de la empresa.
              </p>
            </div>
          </div>
          <div className="flex size-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
            <Scale className="size-10 text-primary" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {serviceAreas.map((area) => (
          <Card key={area.title} className="border-border/50 bg-card/80 shadow-sm">
            <CardHeader className="gap-4">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <area.icon className="size-5" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-sm font-black uppercase tracking-wider">
                  {area.title}
                </CardTitle>
                <CardDescription className="text-xs leading-5">
                  {area.description}
                </CardDescription>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="border-dashed border-border/70 bg-muted/10">
        <CardContent className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ShieldCheck className="size-7" />
          </div>
          <h3 className="text-base font-black uppercase tracking-wide">Vista sin fuente de datos</h3>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Esta maqueta no muestra consultas. El contenido aparecerá cuando se definan el servicio de datos y el flujo de solicitud.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
