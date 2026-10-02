/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import {
  Printer,
  Copy,
  Check,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { toast } from '@/app/services/toast';
import { cn } from '../ui/utils';
import {
  compute6DCostingAndPricing,
  type Cost6DRow,
} from '@/app/utils/pricingEngine';
import { money, formatDate } from './shared';
import { projectsService } from '../../services/projects.service';
import { useTenantQuery } from '../../hooks/useTenantQuery';

export interface ProyectoCotizacionExportViewProps {
  project: any;
  pricingEngine: any;
  costsSummary?: any;
}

interface ContractTierInfo {
  tier: 1 | 2 | 3;
  label: string;
  badgeLabel: string;
  badgeClass: string;
  garantia: string;
  condicionEntrega: string;
  protocolo: string;
  formasPago: string;
  validez: string;
  clausulas: string[];
}

export interface CotizacionPartidaItem {
  num: string;
  key: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

function inferUnit(text: string, explicitUnit?: string): string {
  if (explicitUnit && typeof explicitUnit === 'string' && explicitUnit.trim()) {
    const u = explicitUnit.trim();
    if (/^(glb|global)$/i.test(u)) return 'Global';
    if (/^(m2|m²)$/i.test(u)) return 'm²';
    if (/^(ml|m\.l\.)$/i.test(u)) return 'ml';
    if (/^(lote)$/i.test(u)) return 'Lote';
    return u;
  }
  const clean = text.toLowerCase();
  if (/\b(m2|m²|metro(s)?\s*cuadrado(s)?)\b/.test(clean)) return 'm²';
  if (/\b(ml|m\.l\.|metro(s)?\s*lineal(es)?)\b/.test(clean)) return 'ml';
  if (/\b(lote|kit|juego)\b/.test(clean)) return 'Lote';
  if (/\b(pza|pieza(s)?|und|unidad(es)?)\b/.test(clean)) return 'Pza';
  return 'Global';
}

function inferDescription(row: any, lineName: string): string {
  if (row?.descripcion && typeof row.descripcion === 'string' && row.descripcion.trim()) {
    return row.descripcion.trim();
  }
  if (row?.description && typeof row.description === 'string' && row.description.trim()) {
    return row.description.trim();
  }
  if (row?.notes && typeof row.notes === 'string' && row.notes.trim()) {
    return row.notes.trim();
  }

  const id = String(row?.lineId || '').toLowerCase();
  const name = String(lineName || '').toLowerCase();

  if (id.includes('acm') || name.includes('acm') || name.includes('aluminio compuesto')) {
    return 'Modulación, conformado y montaje de bandejas de ACM calidad arquitectónica exterior, subestructura portante de aluminio aleación 6063-T5, fijaciones estructurales en acero inoxidable y sello perimetral con poliuretano de alta elasticidad.';
  }
  if (id.includes('vidrio') || id.includes('glass') || name.includes('vidrio') || name.includes('cristal')) {
    return 'Suministro e instalación de paneles en vidrio templado de seguridad maquinado con saques y barrenos calibrados, montados mediante clips y botones mecánicos en acero inoxidable con juntas elastoméricas.';
  }
  if (id.includes('wpc') || name.includes('wpc') || name.includes('madera plástica')) {
    return 'Suministro y fijación de perfiles arquitectónicos de WPC para exteriores resistentes a humedad e intemperie UV, con clips de anclaje oculto, perfilería base y remates perimetrales de alta durabilidad.';
  }
  if (id.includes('rotulo') || name.includes('rótulo') || name.includes('rotulo') || name.includes('letras 3d') || name.includes('volumétric')) {
    return 'Diseño estructural, conformado, corte CNC y montaje de rótulos volumétricos 3D e identidad visual corporativa con tratamientos anticorrosivos, iluminación arquitectónica y soportes mecánicos ocultos.';
  }
  if (id.includes('retrabajo') || name.includes('retrabajo') || name.includes('ajuste')) {
    return 'Provisión de ajustes dimensionales en sitio, adecuaciones a desplomes de obra civil y reservas de contingencia de montaje.';
  }
  if (id.includes('concreto') || name.includes('concreto') || name.includes('cimentaci') || id.includes('mamposteria') || name.includes('mampostería')) {
    return 'Elaboración, armado, encofrado y vaciado de elementos estructurales conforme a especificaciones técnicas de resistencia, pruebas de compresión y normas constructivas aplicables.';
  }
  if (id.includes('metal') || name.includes('metálic') || name.includes('metalic') || name.includes('acero') || name.includes('viga')) {
    return 'Habilitación, corte, soldadura certificada, preparación superficial anticorrosiva, izaje y montaje mecánico de perfiles estructurales de acero.';
  }
  if (id.includes('techo') || name.includes('cubierta') || name.includes('techumbre')) {
    return 'Instalación de cubierta y techumbres termoacústicas con elementos de fijación hermética, canaletas de desagüe pluvial y remates de coronación perimetral.';
  }
  if (id.includes('electr') || name.includes('eléctr') || id.includes('instalacion') || name.includes('hidro')) {
    return 'Canalizaciones, cableado estructurado, conexiones, protecciones eléctricas e hidrosanitarias conforme a normativa y código técnico de instalaciones.';
  }
  if (id.includes('pintura') || name.includes('pintura') || name.includes('acabado')) {
    return 'Preparación de superficies, sellado, aplicación de fondo anticorrosivo y capas de acabado de alta intemperie y resistencia.';
  }

  return `Suministro de materiales calificados, mano de obra especializada, equipos y ejecución técnica conforme a especificaciones y requerimientos del proyecto para ${lineName}.`;
}

function getContractTierInfo(
  precioSinIVA: number,
  validityDays = 15,
  advancePct = 70,
  balancePct = 30,
): ContractTierInfo {
  const validezStr = `Oferta técnico-económica con validez ejecutiva de ${validityDays} días hábiles a partir de su emisión. Precios sujetos a confirmación transcurrido dicho período.`;
  const formasPagoStr = `Anticipo del ${advancePct}% a la formalización contractual para asignación de cuadrillas y reserva de insumos; saldo del ${balancePct}% exigible contra culminación de trabajos y suscripción de Acta de Recepción Conforme.`;

  if (precioSinIVA > 7000) {
    return {
      tier: 3,
      label: 'Nivel 3 — Contrato Corporativo de Gran Envergadura',
      badgeLabel: 'Nivel 3: Corporativo (> $7,000)',
      badgeClass:
        'bg-purple-500/10 text-purple-700 border-purple-300 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800',
      garantia:
        'Garantía técnica extendida respaldada por certificaciones de calidad de fabricante en materiales principales y 12 a 24 meses de garantía formal en montajes, estabilidad estructural y hermeticidad.',
      condicionEntrega:
        'Cronograma maestro de ruta crítica (CPM) con seguimiento semanal de hitos de ejecución, supervisión técnica y penalidad formal por mora imputable.',
      protocolo:
        'Contrato formal corporativo protocolizado con anexos técnicos, bitácora de obra y emisión de Acta de Entrega-Recepción definitiva con checklist de calidad y tolerancias.',
      formasPago: formasPagoStr,
      validez: validezStr,
      clausulas: [
        'Contrato corporativo protocolizado con anexos de especificaciones técnicas, memorias de cálculo y planos ejecutivos.',
        'Cronograma maestro de ruta crítica (CPM) con supervisión técnica semanal y reuniones de control de avance.',
        'Garantía directa de fabricantes en insumos certificados y póliza de cumplimiento/calidad de 12 a 24 meses en ejecución.',
        'Cumplimiento estricto de normativas de seguridad ocupacional, seguros de responsabilidad civil y protocolos de obra.',
        'Suscripción formal de Acta de Entrega-Recepción definitiva previa verificación técnica de acabados y tolerancias milimétricas.',
      ],
    };
  }
  if (precioSinIVA >= 3000) {
    return {
      tier: 2,
      label: 'Nivel 2 — Contrato Estándar Profesional',
      badgeLabel: 'Nivel 2: Estándar ($3,000 - $7,000)',
      badgeClass:
        'bg-blue-500/10 text-blue-700 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
      garantia:
        'Garantía técnica de 12 meses (1 año) en mano de obra calificada, ensambles, fijaciones estructurales y selladores de alta intemperie contra vicios ocultos.',
      condicionEntrega:
        'Planificación programada de obra con reserva prioritaria de materiales, entrega técnica en plazo pactado y control de lotes.',
      protocolo:
        'Protocolo formal de hitos de entrega con validación previa de avance físico y soporte técnico post-entrega asegurado durante los primeros 90 días.',
      formasPago: formasPagoStr,
      validez: validezStr,
      clausulas: [
        'Contrato formal de obra y servicios técnicos con especificaciones de partida y calendario de entregas.',
        'Garantía extendida de 12 meses en montaje estructural, sellos climáticos y estabilidad de componentes.',
        'Protocolo formal de hitos de entrega con inspección conjunta de avance físico previa recepción definitiva.',
        'Soporte técnico preferencial y acompañamiento post-entrega asegurado durante los primeros 90 días de operación.',
        'Reserva inmediata de materiales con trazabilidad de tono, lote y especificación técnica de ingeniería.',
      ],
    };
  }
  return {
    tier: 1,
    label: 'Nivel 1 — Contrato Simplificado / Ágil',
    badgeLabel: 'Nivel 1: Simplificado (< $3,000)',
    badgeClass:
      'bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
    garantia:
      'Garantía comercial estándar de 6 meses contra defectos de manufactura, componentes mecánicos y mano de obra en montaje a partir de la entrega.',
    condicionEntrega:
      'Plazo ágil de entrega sujeto a disponibilidad inmediata de existencias en bodega y programación expedita de cuadrilla.',
    protocolo:
      'Términos comerciales simplificados bajo orden de compra y suscripción de Acta de Recepción Conforme a entera satisfacción.',
    formasPago: formasPagoStr,
    validez: validezStr,
    clausulas: [
      'Términos simplificados de compraventa y servicios técnicos sobre orden de compra aprobada.',
      'Garantía comercial de 6 meses sobre mano de obra, fijaciones, ensambles y herrajes.',
      'Plazo de ejecución computado a partir de la acreditación del anticipo contractual.',
      'Inspección final y finiquito contra entrega a entera satisfacción del cliente mediante acta de recepción.',
    ],
  };
}

export function ProyectoCotizacionExportView({
  project,
  pricingEngine,
  costsSummary: _costsSummary,
}: ProyectoCotizacionExportViewProps) {
  const [copied, setCopied] = useState(false);

  const projectId = project?.id;
  const costLinesQuery = useTenantQuery<any[]>(
    ['projects', projectId, 'costing-lines'],
    (signal) => projectsService.getCostLines(projectId, signal),
    { enabled: Boolean(projectId) },
  );

  // La cotización siempre parte de la matriz persistida del proyecto.
  const matrix = useMemo<Cost6DRow[]>(() => {
    return (costLinesQuery.data || []).map((line: any) => ({
      ...line, lineId: line.id, lineName: line.name,
      materiales: Number(line.materiales || 0), consumibles: Number(line.consumibles || 0),
      manoObra: Number(line.manoObra || 0), andamiosEquipos: Number(line.andamiosEquipos || 0),
      fletes: Number(line.fletes || 0), viaticos: Number(line.viaticos || 0),
      unidad: line.unit, cantidad: Number(line.quantity || 1), descripcion: line.description,
    }));
  }, [costLinesQuery.data]);

  // 2. Cálculo unificado a través del motor puro 6D
  const costingResult = useMemo(() => {
    return compute6DCostingAndPricing(matrix, pricingEngine);
  }, [matrix, pricingEngine]);

  // 3. Extracción de partidas reales con cálculo de precios y subtotales
  const partidas = useMemo<CotizacionPartidaItem[]>(() => {
    const rawLines = costingResult?.lines;

    const mapped = matrix.map((row: any, idx: number) => {
      const lineKey = String(row.lineId);
      const lineData = rawLines
        ? (rawLines[lineKey] || (Array.isArray(rawLines) ? rawLines.find((l: any) => l.lineId === lineKey || l.lineKey === lineKey) : null))
        : null;

      const subtotal = Number(
        lineData?.precioSinIVA ??
        lineData?.subtotalSinIVA ??
        (row.materiales + row.consumibles + row.manoObra + row.andamiosEquipos + row.fletes + row.viaticos) * 1.25,
      );

      const cantidad = Math.max(1, Number(row.cantidad || row.quantity || 1));
      const precioUnitario = subtotal / cantidad;
      const nombre = String(row.lineName || row.name || row.concept || `Partida ${idx + 1}`);
      const unidad = inferUnit(nombre, row.unidad || row.unit);
      const descripcion = inferDescription(row, nombre);

      return {
        num: String(idx + 1).padStart(2, '0'),
        key: lineKey || `line_${idx}`,
        nombre,
        descripcion,
        unidad,
        cantidad,
        precioUnitario,
        subtotal,
      };
    });

    const hasPositive = mapped.some((p) => p.subtotal > 0);
    const filtered = hasPositive ? mapped.filter((p) => p.subtotal > 0) : mapped;

    return filtered.map((p, idx) => ({
      ...p,
      num: String(idx + 1).padStart(2, '0'),
    }));
  }, [matrix, costingResult]);

  // 4. Extracción de datos de identificación
  const clientName =
    pricingEngine?.clientName || project?.customer?.name || 'Cliente Corporativo';
  const quoteNumber =
    pricingEngine?.quoteNumber || (project?.code ? `COT-${project.code}` : 'COT-001');
  const advisorName =
    pricingEngine?.advisorName || project?.manager?.name || 'Asesor Comercial NovaHub';
  const quoteValidityDays =
    pricingEngine?.quoteValidityDays != null
      ? Number(pricingEngine.quoteValidityDays)
      : 15;
  const currency = project?.currency || 'USD';

  // 5. Cifras económicas globales unificadas
  const subtotalSumPartidas = partidas.reduce((acc, p) => acc + p.subtotal, 0);
  const precioSinIVA = Number(
    costingResult?.precioSinIVA ??
    costingResult?.totals?.precioSinIVA ??
    subtotalSumPartidas,
  );

  const ivaRate = pricingEngine?.ivaRate != null ? Number(pricingEngine.ivaRate) : 0.15;
  const iva = Number(
    costingResult?.totals?.ivaTotal ??
    costingResult?.pricing?.ivaAmount ??
    precioSinIVA * ivaRate,
  );

  const precioConIVA = Number(
    costingResult?.precioConIVA ??
    costingResult?.totals?.precioConIVA ??
    precioSinIVA + iva,
  );

  const advanceRate = Number(pricingEngine?.advancePaymentRate ?? 0.70);
  const balanceRate = Math.max(0, 1 - advanceRate);

  const anticipo70ConIVA = precioConIVA * advanceRate;
  const saldo30ConIVA = precioConIVA * balanceRate;

  const anticipo70SinIVA = precioSinIVA * advanceRate;
  const saldo30SinIVA = precioSinIVA * balanceRate;

  // 6. Nivel contractual dinámico
  const tierInfo = useMemo(() => {
    return getContractTierInfo(
      precioSinIVA,
      quoteValidityDays,
      Math.round(advanceRate * 100),
      Math.round(balanceRate * 100),
    );
  }, [precioSinIVA, quoteValidityDays, advanceRate, balanceRate]);

  // Manejador de copia comercial
  const handleCopySummary = async () => {
    const summaryText = `*COTIZACIÓN EJECUTIVA — NOVAHUB S.A.*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  N° Cotización: ${quoteNumber}
  Cliente: ${clientName}
  Proyecto: ${project?.name || 'Proyecto NovaHub'} (${project?.code || 'S/C'})
  Asesor Comercial: ${advisorName}
  Validez: ${quoteValidityDays} días hábiles
  Clasificación: ${tierInfo.badgeLabel}

  RESUMEN ECONÓMICO:
• Subtotal sin IVA: ${money(precioSinIVA, currency)}
• IVA (15%): ${money(iva, currency)}
• Total General con IVA: ${money(precioConIVA, currency)}

  CONDICIONES DE PAGO (${Math.round(advanceRate * 100)}% / ${Math.round(balanceRate * 100)}%):
• Anticipo Contractual (${Math.round(advanceRate * 100)}%): ${money(anticipo70ConIVA, currency)} (con IVA) | ${money(anticipo70SinIVA, currency)} (sin IVA)
• Saldo contra Entrega (${Math.round(balanceRate * 100)}%): ${money(saldo30ConIVA, currency)} (con IVA) | ${money(saldo30SinIVA, currency)} (sin IVA)

📦 PARTIDAS OFERTADAS:
${partidas
        .map(
          (p) =>
            `• [${p.num}] ${p.nombre} (${p.cantidad} ${p.unidad}): ${money(p.subtotal, currency)} sin IVA`,
        )
        .join('\n')}

  GARANTÍA & TÉRMINOS:
• Garantía: ${tierInfo.garantia}
• Plazo y Entrega: ${tierInfo.condicionEntrega}
• Formas de Pago: ${tierInfo.formasPago}
• Protocolo: ${tierInfo.protocolo}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Quedamos a su disposición para la formalización del contrato.`;

    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      toast.success('Resumen comercial copiado al portapapeles.');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('No se pudo copiar el resumen al portapapeles.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const fechaEmision = formatDate(new Date().toISOString());

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* Estilos específicos para impresión */}
      <style>{`
        @media print {
          @page {
            size: letter portrait;
            margin: 12mm 14mm;
          }
          body {
            background: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-doc-container {
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            background: white !important;
          }
          .print-no-break {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      {/* 1. BARRA DE HERRAMIENTAS SUPERIOR (No imprimible) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3.5 backdrop-blur-sm print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="outline" className={cn('font-bold py-1 px-3 shadow-2xs', tierInfo.badgeClass)}>
            <ShieldCheck className="mr-1.5 size-3.5" />
            {tierInfo.badgeLabel}
          </Badge>
          <span className="text-xs text-muted-foreground hidden md:inline">
            Documento de propuesta formal generado por el Motor 6D NovaHub
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopySummary}
            className="rounded-xl border-border/60 font-semibold transition-all hover:bg-muted"
          >
            {copied ? (
              <>
                <Check className="mr-1.5 size-4 text-emerald-600" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Copy className="mr-1.5 size-4" />
                <span>Copiar Resumen Comercial</span>
              </>
            )}
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={handlePrint}
            className="rounded-xl font-bold shadow-sm"
          >
            <Printer className="mr-1.5 size-4" />
            <span>Imprimir / Exportar PDF</span>
          </Button>
        </div>
      </div>

      {/* 2. HOJA DE COTIZACIÓN ESTILIZADA */}
      <div className="print-doc-container mx-auto max-w-4xl rounded-2xl border border-border/70 bg-card p-8 md:p-10 shadow-sm transition-all print:border-none print:bg-white print:p-0 print:shadow-none print:text-black">
        {/* ENCABEZADO CON MEMBRETE CORPORATIVO */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 border-b border-border/70 pb-6 print:border-neutral-300">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-sm print:bg-neutral-900 print:text-white">
                NH
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-foreground print:text-neutral-900">
                  NOVAHUB S.A.
                </h1>
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider print:text-neutral-600">
                  Ingeniería, Construcción & Arquitectura Integral
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5 pt-1.5 print:text-neutral-600">
              <p>RUC: J0310000329182 · Managua, Nicaragua</p>
              <p>Tel: +505 2222-0000 · Email: contacto@novahub.com.ni</p>
              <p>Contratos de Obras, Servicios Técnicos Especializados & Suministro Industrial</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/20 p-4 sm:min-w-[280px] print:border-neutral-300 print:bg-neutral-50">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2 mb-2 print:border-neutral-200">
              <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground print:text-neutral-500">
                Cotización Comercial
              </span>
              <Badge variant="outline" className="font-mono text-xs font-bold border-primary/40 text-primary print:border-neutral-400 print:text-neutral-900">
                {quoteNumber}
              </Badge>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground print:text-neutral-500">Fecha de Emisión:</span>
                <span className="font-semibold text-foreground print:text-neutral-900">{fechaEmision}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground print:text-neutral-500">Validez Oferta:</span>
                <span className="font-bold text-foreground print:text-neutral-900">{quoteValidityDays} días hábiles</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground print:text-neutral-500">Moneda Cotizada:</span>
                <span className="font-bold text-foreground print:text-neutral-900">{currency}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-border/40 print:border-neutral-200">
                <span className="text-muted-foreground print:text-neutral-500">Nivel Contractual:</span>
                <span className="font-bold text-foreground print:text-neutral-900">Tier {tierInfo.tier}</span>
              </div>
            </div>
          </div>
        </div>

        {/* METADATOS DE CLIENTE Y PROYECTO */}
        <div className="my-6 grid grid-cols-1 md:grid-cols-2 gap-4 rounded-xl border border-border/60 bg-muted/10 p-4 print:border-neutral-300 print:bg-neutral-50/50">
          <div className="space-y-1 text-xs">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground print:text-neutral-500">
              Datos del Cliente / Empresa
            </p>
            <p className="text-sm font-black text-foreground print:text-neutral-900">
              {clientName}
            </p>
            {project?.customer?.email && (
              <p className="text-muted-foreground print:text-neutral-600">Email: {project.customer.email}</p>
            )}
            {project?.customer?.phone && (
              <p className="text-muted-foreground print:text-neutral-600">Tel: {project.customer.phone}</p>
            )}
            {project?.customer?.taxId && (
              <p className="text-muted-foreground print:text-neutral-600">RUC/Identificación: {project.customer.taxId}</p>
            )}
          </div>

          <div className="space-y-1 text-xs">
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground print:text-neutral-500">
              Proyecto & Ubicación
            </p>
            <p className="text-sm font-black text-foreground print:text-neutral-900">
              {project?.name || 'Sin título'}{' '}
              {project?.code && <span className="font-mono text-xs font-semibold text-primary">({project.code})</span>}
            </p>
            <p className="text-muted-foreground print:text-neutral-600">
              Ubicación / Sucursal: {project?.branch?.name || 'Managua, Nicaragua'}
            </p>
            <p className="text-muted-foreground print:text-neutral-600">
              Asesor Comercial Responsable:{' '}
              <span className="font-bold text-foreground print:text-neutral-900">{advisorName}</span>
            </p>
          </div>
        </div>

        {/* TABLA FORMAL DE PARTIDAS OFERTADAS */}
        <div className="my-6 rounded-xl border border-border/70 overflow-hidden print:border-neutral-300">
          <Table>
            <TableHeader className="bg-muted/30 print:bg-neutral-100">
              <TableRow className="border-b border-border/70 print:border-neutral-300">
                <TableHead className="w-12 text-center text-xs font-black uppercase tracking-wider print:text-neutral-800">
                  Ítem
                </TableHead>
                <TableHead className="text-xs font-black uppercase tracking-wider print:text-neutral-800">
                  Descripción de la Partida Ofertada
                </TableHead>
                <TableHead className="w-24 text-center text-xs font-black uppercase tracking-wider print:text-neutral-800">
                  Unidad
                </TableHead>
                <TableHead className="w-20 text-center text-xs font-black uppercase tracking-wider print:text-neutral-800">
                  Cantidad
                </TableHead>
                <TableHead className="w-32 text-right text-xs font-black uppercase tracking-wider print:text-neutral-800">
                  P. Unitario ({currency})
                </TableHead>
                <TableHead className="w-36 text-right text-xs font-black uppercase tracking-wider print:text-neutral-800">
                  Subtotal sin IVA
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partidas.map((p) => (
                <TableRow
                  key={p.key}
                  className="border-b border-border/40 hover:bg-muted/10 print:border-neutral-200"
                >
                  <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground print:text-neutral-600">
                    {p.num}
                  </TableCell>
                  <TableCell className="py-3 space-y-1">
                    <p className="text-xs font-bold text-foreground print:text-neutral-900">
                      {p.nombre}
                    </p>
                    <p className="text-[11px] leading-relaxed text-muted-foreground print:text-neutral-600">
                      {p.descripcion}
                    </p>
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-semibold print:text-neutral-800">
                    {p.unidad}
                  </TableCell>
                  <TableCell className="text-center font-mono text-xs font-semibold print:text-neutral-800">
                    {p.cantidad}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-semibold print:text-neutral-800">
                    {money(p.precioUnitario, currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs font-black text-foreground print:text-neutral-900">
                    {money(p.subtotal, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* BLOQUE DE TOTALES */}
        <div className="my-6 flex flex-col sm:flex-row justify-end print-no-break">
          <div className="w-full sm:w-84 rounded-xl border border-border/70 bg-muted/20 p-4 space-y-2.5 print:border-neutral-300 print:bg-neutral-50">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground print:text-neutral-600 font-medium">
                Subtotal Ofertado sin IVA:
              </span>
              <span className="font-mono font-bold text-foreground print:text-neutral-900">
                {money(precioSinIVA, currency)}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground print:text-neutral-600 font-medium">
                IVA (15% de Ley):
              </span>
              <span className="font-mono font-bold text-foreground print:text-neutral-900">
                {money(iva, currency)}
              </span>
            </div>
            <div className="border-t border-border/70 pt-2 flex justify-between items-center print:border-neutral-300">
              <span className="text-sm font-black text-foreground print:text-neutral-900">
                Total General con IVA:
              </span>
              <span className="font-mono text-base font-black text-primary print:text-neutral-900">
                {money(precioConIVA, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* CONDICIONES DE PAGO 70% / 30% */}
        <div className="my-6 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3 print:border-neutral-400 print:bg-neutral-50 print-no-break">
          <div className="flex items-center gap-2">
            <CreditCard className="size-4 text-primary print:text-neutral-800" />
            <h3 className="text-xs font-black uppercase tracking-wider text-foreground print:text-neutral-900">
              Condiciones de Pago Contractuales ({Math.round(advanceRate * 100)}% / {Math.round(balanceRate * 100)}%)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1 print:border-neutral-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-primary print:text-neutral-900">
                  1. Anticipo Contractual ({Math.round(advanceRate * 100)}%)
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-primary/30 text-primary print:border-neutral-400 print:text-neutral-900"
                >
                  Inicio de Obra
                </Badge>
              </div>
              <p className="font-mono text-lg font-black text-foreground print:text-neutral-900">
                {money(anticipo70ConIVA, currency)}{' '}
                <span className="text-xs font-normal text-muted-foreground print:text-neutral-500">
                  (con IVA)
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground print:text-neutral-600">
                Monto base sin IVA: <span className="font-mono font-bold">{money(anticipo70SinIVA, currency)}</span>
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground print:text-neutral-600 pt-1">
                Requisito indispensable para emisión de órdenes de compra, reserva de materiales, importación y habilitación de cuadrillas.
              </p>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-3 space-y-1 print:border-neutral-300 print:bg-white">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase text-foreground print:text-neutral-900">
                  2. Saldo Final ({Math.round(balanceRate * 100)}%)
                </span>
                <Badge
                  variant="outline"
                  className="text-[10px] font-bold border-border/60 text-muted-foreground print:border-neutral-400 print:text-neutral-900"
                >
                  Contra Entrega
                </Badge>
              </div>
              <p className="font-mono text-lg font-black text-foreground print:text-neutral-900">
                {money(saldo30ConIVA, currency)}{' '}
                <span className="text-xs font-normal text-muted-foreground print:text-neutral-500">
                  (con IVA)
                </span>
              </p>
              <p className="text-[11px] text-muted-foreground print:text-neutral-600">
                Monto base sin IVA: <span className="font-mono font-bold">{money(saldo30SinIVA, currency)}</span>
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground print:text-neutral-600 pt-1">
                Exigible contra culminación de ejecución, inspección técnica final y suscripción de Acta de Recepción Conforme.
              </p>
            </div>
          </div>
        </div>

        {/* SECCIÓN DE TÉRMINOS Y GARANTÍAS SEGÚN EL NIVEL CONTRACTUAL */}
        <div className="my-6 rounded-xl border border-border/70 bg-muted/20 p-4 space-y-3 print:border-neutral-300 print:bg-neutral-50 print-no-break">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary print:text-neutral-800" />
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground print:text-neutral-900">
                Términos Contractuales y Garantías del Servicio
              </h3>
            </div>
            <Badge variant="outline" className={cn('text-[11px] font-bold py-0.5', tierInfo.badgeClass)}>
              {tierInfo.label}
            </Badge>
          </div>

          <div className="space-y-2 text-xs">
            <div className="rounded-lg bg-card p-3 border border-border/40 print:border-neutral-200 print:bg-white">
              <p className="font-bold text-foreground print:text-neutral-900 mb-1">
                Alcance y Cobertura de Garantía:
              </p>
              <p className="text-muted-foreground leading-relaxed print:text-neutral-700">
                {tierInfo.garantia}
              </p>
            </div>

            <div className="rounded-lg bg-card p-3 border border-border/40 print:border-neutral-200 print:bg-white">
              <p className="font-bold text-foreground print:text-neutral-900 mb-1">
                Protocolo de Entrega y Soporte:
              </p>
              <p className="text-muted-foreground leading-relaxed print:text-neutral-700">
                {tierInfo.protocolo}. {tierInfo.condicionEntrega}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="rounded-lg bg-card p-3 border border-border/40 print:border-neutral-200 print:bg-white">
                <p className="font-bold text-foreground print:text-neutral-900 mb-1">
                  Validez y Plazo de la Oferta:
                </p>
                <p className="text-muted-foreground leading-relaxed print:text-neutral-700">
                  {tierInfo.validez}
                </p>
              </div>

              <div className="rounded-lg bg-card p-3 border border-border/40 print:border-neutral-200 print:bg-white">
                <p className="font-bold text-foreground print:text-neutral-900 mb-1">
                  Formas de Pago Acordadas:
                </p>
                <p className="text-muted-foreground leading-relaxed print:text-neutral-700">
                  {tierInfo.formasPago}
                </p>
              </div>
            </div>

            <div className="pt-1 space-y-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground print:text-neutral-600">
                Cláusulas Contractuales Aplicables:
              </p>
              <ul className="space-y-1 list-disc list-inside text-[11px] text-muted-foreground print:text-neutral-700">
                {tierInfo.clausulas.map((clausula, idx) => (
                  <li key={idx} className="leading-relaxed">
                    {clausula}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* ESPACIO DE FIRMA PARA APROBACIÓN */}
        <div className="mt-10 pt-6 border-t border-border/70 print:border-neutral-300 print:pt-12 print-no-break">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 text-center text-xs">
            <div className="space-y-2">
              <div className="border-b border-foreground/30 pb-2 mx-6 print:border-neutral-500">
                <p className="font-bold text-foreground print:text-neutral-900">
                  {clientName}
                </p>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground print:text-neutral-600">
                Aprobación del Cliente / Representante Legal
              </p>
              <p className="text-[10px] text-muted-foreground/80 print:text-neutral-500">
                Firma, Sello y Cédula / RUC
              </p>
            </div>

            <div className="space-y-2">
              <div className="border-b border-foreground/30 pb-2 mx-6 print:border-neutral-500">
                <p className="font-bold text-foreground print:text-neutral-900">
                  {advisorName}
                </p>
              </div>
              <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground print:text-neutral-600">
                Por NovaHub S.A. / Dirección Comercial
              </p>
              <p className="text-[10px] text-muted-foreground/80 print:text-neutral-500">
                Firma y Sello Autorizado
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
