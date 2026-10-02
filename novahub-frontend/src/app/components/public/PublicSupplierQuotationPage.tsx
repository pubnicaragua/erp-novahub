import { useEffect, useState, useMemo } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  FileCheck,
  Send,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Skeleton } from '../ui/skeleton';
import { projectsService } from '../../services/projects.service';

interface MaterialOfferRow {
  materialId: string;
  offerId: string;
  description: string;
  unit: string;
  quantity: number;
  specifications?: string;
  unitPrice: number;
  deliveryDays?: number;
  deliveryTime?: string;
  observations?: string;
}

interface PublicMaterialItem {
  materialId: string;
  offerId: string;
  description: string;
  unit: string;
  quantity: number;
  specifications?: string;
  unitPrice?: number;
  deliveryDays?: number;
  deliveryTime?: string;
  observations?: string;
}

interface PublicSubQuotationData {
  company?: { name: string; logo?: string };
  project: { id: string; code: string; name: string };
  quotation: { id: string; code: string; name: string };
  subQuotation: {
    id: string;
    code: string;
    currency: string;
    status: string;
    isReadOnly?: boolean;
    editableUntil?: string | null;
    taxAmount?: number;
    supplierNotes?: string | null;
  };
  supplier: { id: string; name: string };
  termsAccepted: boolean;
  materials: PublicMaterialItem[];
}

export function PublicSupplierQuotationPage() {
  const pathname = window.location.pathname;
  const token = pathname.replace(/^\/public\/subquotation\/?/, '').split('/')[0] || '';

  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [error, setError] = useState<string | null>(token ? null : 'Enlace inválido o incompleto.');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [data, setData] = useState<PublicSubQuotationData | null>(null);

  // Form states
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [offers, setOffers] = useState<MaterialOfferRow[]>([]);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [supplierNotes, setSupplierNotes] = useState<string>('');

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    projectsService
      .getPublicSubQuotation(token)
      .then((res: PublicSubQuotationData) => {
        if (!isMounted) return;
        setData(res);
        setTermsAccepted(Boolean(res.termsAccepted));
        setTaxAmount(res.subQuotation.taxAmount || 0);
        setSupplierNotes(res.subQuotation.supplierNotes || '');

        const mappedOffers: MaterialOfferRow[] = (res.materials || []).map((m: PublicMaterialItem) => ({
          materialId: m.materialId,
          offerId: m.offerId,
          description: m.description,
          unit: m.unit,
          quantity: m.quantity,
          specifications: m.specifications,
          unitPrice: m.unitPrice || 0,
          deliveryDays: m.deliveryDays || undefined,
          deliveryTime: m.deliveryTime || '',
          observations: m.observations || '',
        }));
        setOffers(mappedOffers);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'El enlace ha expirado o no es válido.');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const reloadData = async () => {
    if (!token) return;
    try {
      const res = (await projectsService.getPublicSubQuotation(token)) as PublicSubQuotationData;
      setData(res);
      setTermsAccepted(Boolean(res.termsAccepted));
      setTaxAmount(res.subQuotation.taxAmount || 0);
      setSupplierNotes(res.subQuotation.supplierNotes || '');
    } catch {
      // ignore
    }
  };

  const handlePriceChange = (materialId: string, val: string) => {
    const num = parseFloat(val) || 0;
    setOffers((prev) =>
      prev.map((o) => (o.materialId === materialId ? { ...o, unitPrice: num } : o)),
    );
  };

  const handleDeliveryChange = (materialId: string, val: string) => {
    const num = parseInt(val, 10) || undefined;
    setOffers((prev) =>
      prev.map((o) => (o.materialId === materialId ? { ...o, deliveryDays: num } : o)),
    );
  };

  const handleObservationsChange = (materialId: string, val: string) => {
    setOffers((prev) =>
      prev.map((o) => (o.materialId === materialId ? { ...o, observations: val } : o)),
    );
  };

  const calculatedSubtotal = useMemo(() => {
    return offers.reduce((sum, o) => sum + (o.quantity || 0) * (o.unitPrice || 0), 0);
  }, [offers]);

  const calculatedTotal = useMemo(() => {
    return calculatedSubtotal + (Number(taxAmount) || 0);
  }, [calculatedSubtotal, taxAmount]);

  const handleAcceptTerms = async () => {
    try {
      setAcceptingTerms(true);
      await projectsService.acceptSupplierTerms(token, { termsVersion: 'v1.0' });
      setTermsAccepted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || 'No fue posible registrar la aceptación de términos.');
    } finally {
      setAcceptingTerms(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      alert('Debe aceptar los Términos y Condiciones antes de enviar.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        offers: offers.map((o) => ({
          materialId: o.materialId,
          unitPrice: o.unitPrice,
          deliveryDays: o.deliveryDays,
          deliveryTime: o.deliveryTime,
          observations: o.observations,
        })),
        taxAmount: Number(taxAmount) || 0,
        supplierNotes,
      };

      await projectsService.submitSupplierOffer(token, payload);
      setSuccessMsg('¡Cotización enviada exitosamente!');
      await reloadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || 'No se pudo enviar la cotización.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <Skeleton className="h-14 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8 flex items-center justify-center">
        <Card className="w-full max-w-md border-destructive/30 text-center shadow-xl">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
              <AlertCircle className="size-8" />
            </div>
            <CardTitle className="text-xl font-bold">Enlace no disponible</CardTitle>
            <CardDescription className="text-sm">
              {error || 'No fue posible acceder al formulario de cotización.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { company, project, quotation, subQuotation, supplier } = data;
  const isReadOnly = Boolean(subQuotation?.isReadOnly);
  const customStyle = company?.primaryColor ? ({ '--primary': company.primaryColor, '--ring': company.primaryColor } as React.CSSProperties) : undefined;

  return (
    <div style={customStyle} className="min-h-screen bg-gradient-to-b from-background via-muted/10 to-background text-foreground selection:bg-primary/20">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/60 backdrop-blur-md sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-4 py-3 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {company?.logo ? (
              <img src={company.logo} alt={company.name} className="size-10 rounded-xl object-contain border border-border/50 bg-background p-1" />
            ) : (
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                <Building2 className="size-5" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-bold truncate text-foreground/90">{company?.name || 'NovaHub ERP'}</h1>
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                <ShoppingBag className="size-3 text-primary" /> Solicitud de Cotización a Proveedor
              </span>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-xs font-semibold px-2.5 py-1">
            {subQuotation.currency || 'NIO'}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Success Alert */}
        {successMsg ? (
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-3">
            <CheckCircle2 className="size-5 shrink-0" />
            <span className="text-sm font-semibold">{successMsg}</span>
          </div>
        ) : null}

        {/* Read-Only / Closed Window Banner */}
        {isReadOnly ? (
          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 flex items-center gap-3">
            <Clock className="size-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Ventana de edición cerrada</p>
              <p className="text-xs opacity-90">Esta cotización ya fue recibida de manera definitiva y se encuentra en modo solo lectura.</p>
            </div>
          </div>
        ) : subQuotation?.editableUntil ? (
          <div className="p-4 rounded-xl border border-primary/30 bg-primary/10 text-primary flex items-center gap-3">
            <Clock className="size-5 shrink-0" />
            <div className="text-sm">
              <p className="font-bold">Ventana de edición abierta</p>
              <p className="text-xs opacity-90">
                Puede actualizar sus precios hasta el: {new Date(subQuotation.editableUntil).toLocaleString('es-NI')}
              </p>
            </div>
          </div>
        ) : null}

        {/* Reference Hero Card */}
        <Card className="border-border/60 shadow-lg">
          <CardHeader className="p-5 pb-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                Subcotización: {subQuotation.code}
              </span>
              <Badge variant="outline" className="text-xs">
                Ref. Cotización: {quotation.code}
              </Badge>
            </div>
            <CardTitle className="text-xl font-bold">{quotation.name}</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Proyecto: <span className="font-medium text-foreground">{project.name} ({project.code})</span> · Proveedor: <span className="font-medium text-foreground">{supplier.name}</span>
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Terms and Conditions Box */}
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <CardTitle className="text-base font-bold">Términos y Condiciones Comerciales</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            <div className="p-3.5 rounded-xl border border-border/40 bg-muted/20 text-xs text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground/90 mb-1">Declaración de Validez de Oferta (v1.0):</p>
              Al completar y enviar esta cotización, el proveedor confirma que los precios, cantidades y plazos de entrega ofrecidos son firmes, válidos por al menos 15 días calendario, y sujetos a los términos de contratación y compra acordados con el solicitante.
            </div>

            {termsAccepted ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4" /> Términos y condiciones aceptados correctamente
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Debe aceptar los términos para desbloquear el llenado de precios.
                </p>
                <Button
                  size="sm"
                  onClick={handleAcceptTerms}
                  disabled={acceptingTerms || isReadOnly}
                  className="gap-2 text-xs"
                >
                  <FileCheck className="size-4" /> Aceptar Términos y Continuar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Materials Table & Pricing Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="border-border/60 shadow-lg overflow-hidden">
            <CardHeader className="p-5 pb-3">
              <CardTitle className="text-base font-bold">Materiales Solicitados</CardTitle>
              <CardDescription className="text-xs">
                Por favor ingrese el precio unitario y plazo de entrega estimado para cada ítem.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/30 text-muted-foreground uppercase tracking-wider text-[11px]">
                      <th className="p-3 pl-5">#</th>
                      <th className="p-3">Descripción</th>
                      <th className="p-3 text-center">Unidad</th>
                      <th className="p-3 text-right">Cantidad</th>
                      <th className="p-3 text-right w-36">Precio Unitario ({subQuotation.currency})</th>
                      <th className="p-3 text-right w-24">Plazo (Días)</th>
                      <th className="p-3 text-right pr-5">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {offers.map((row, idx) => {
                      const itemSubtotal = (row.quantity || 0) * (row.unitPrice || 0);
                      const disabled = !termsAccepted || isReadOnly || submitting;

                      return (
                        <tr key={row.materialId} className="hover:bg-muted/10 transition-colors">
                          <td className="p-3 pl-5 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="p-3">
                            <p className="font-semibold text-foreground/90">{row.description}</p>
                            {row.specifications ? (
                              <p className="text-[11px] text-muted-foreground">{row.specifications}</p>
                            ) : null}
                            {!disabled ? (
                              <Input
                                placeholder="Observaciones / marca ofrecida (opcional)"
                                value={row.observations || ''}
                                onChange={(e) => handleObservationsChange(row.materialId, e.target.value)}
                                className="h-7 text-[11px] mt-1.5 bg-background/50 border-border/50"
                              />
                            ) : row.observations ? (
                              <p className="text-[11px] text-muted-foreground italic mt-0.5">Nota: {row.observations}</p>
                            ) : null}
                          </td>
                          <td className="p-3 text-center font-mono">{row.unit}</td>
                          <td className="p-3 text-right font-mono font-bold">{row.quantity}</td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              disabled={disabled}
                              value={row.unitPrice === 0 ? '' : row.unitPrice}
                              onChange={(e) => handlePriceChange(row.materialId, e.target.value)}
                              placeholder="0.00"
                              className="h-8 text-right font-mono font-bold text-xs"
                              required
                            />
                          </td>
                          <td className="p-3 text-right">
                            <Input
                              type="number"
                              min="0"
                              disabled={disabled}
                              value={row.deliveryDays === undefined ? '' : row.deliveryDays}
                              onChange={(e) => handleDeliveryChange(row.materialId, e.target.value)}
                              placeholder="Días"
                              className="h-8 text-right font-mono text-xs"
                            />
                          </td>
                          <td className="p-3 text-right pr-5 font-mono font-bold">
                            {subQuotation.currency} {itemSubtotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Totals & Notes Section */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold">Notas u Observaciones Generales</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <Textarea
                  placeholder="Indique condiciones de pago, validez de la oferta u otras aclaraciones..."
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  disabled={!termsAccepted || isReadOnly || submitting}
                  className="text-xs min-h-[110px]"
                />
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-muted/10">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-bold">Resumen de la Cotización</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-3 text-xs">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Subtotal Ítems:</span>
                  <span className="font-mono font-bold text-foreground">
                    {subQuotation.currency} {calculatedSubtotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <span className="text-muted-foreground">Impuesto / IVA ({subQuotation.currency}):</span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={!termsAccepted || isReadOnly || submitting}
                    value={taxAmount === 0 ? '' : taxAmount}
                    onChange={(e) => setTaxAmount(parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    className="h-7 w-28 text-right font-mono text-xs font-semibold"
                  />
                </div>
                <div className="border-t border-border/50 pt-2 flex justify-between items-center text-sm font-bold">
                  <span>Total Ofertado:</span>
                  <span className="font-mono text-lg text-primary">
                    {subQuotation.currency} {calculatedTotal.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {!isReadOnly ? (
                  <Button
                    type="submit"
                    disabled={!termsAccepted || submitting || calculatedSubtotal <= 0}
                    className="w-full mt-3 gap-2 font-bold"
                  >
                    <Send className="size-4" />
                    {submitting ? 'Enviando oferta...' : 'Enviar Cotización al Cliente'}
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>© {new Date().getFullYear()} {company?.name || 'NovaHub ERP'}. Portal seguro de proveedores.</p>
      </footer>
    </div>
  );
}
