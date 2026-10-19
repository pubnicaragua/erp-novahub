import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { Label } from "../../ui/label";
import { Input } from "../../ui/input";
import { BankAccountSelect } from "../../ui/BankAccountSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import {
  cajaService,
  type CashRegister,
  type CashRegisterSession,
} from "../../../services/caja.service";
import {
  salesImportService,
  type SalesImportBatch,
  type SalesImportInvoicePreviewDocument,
  type SalesImportInvoicePreviewResponse,
  type SalesImportKind,
  type SalesImportPreviewResponse,
} from "../../../services/sales-import.service";
import { toast } from "@/app/services/toast";
import { getApiErrorMessage } from "../../../services/api";
import { shouldRestoreSalesImportBatch } from "./sales-import-preview-state";
import {
  hasPaymentReferenceField,
  isBankPaymentMethod,
  paymentMethodLabel,
  requiresPaymentReference,
} from "../../../utils/paymentMethods";

const NO_REGISTER = "__no_cash_session__";
const BATCH_STORAGE_PREFIX = "novahub-sales-import-batch:";
const invoicePaymentMethodOptions = [
  { label: "Efectivo", value: "CASH" },
  { label: "Tarjeta", value: "CARD" },
  { label: "Transferencia", value: "TRANSFER" },
  { label: "Cheque", value: "CHECK" },
] as const;

type InvoicePaymentField = "paymentMethod" | "paymentReference" | "bankAccountNumber";

function normalizeInvoicePaymentMethod(value?: string | null) {
  const normalized = String(value || "CASH").trim().toUpperCase();
  return ({ EFECTIVO: "CASH", TARJETA: "CARD", TRANSFERENCIA: "TRANSFER", CHEQUE: "CHECK" } as Record<string, string>)[normalized] || normalized;
}

function invoicePaymentFieldFromIssue(field?: string) {
  const normalized = String(field || "").trim().toLocaleLowerCase("es-NI").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (normalized.includes("metodo de pago")) return "paymentMethod";
  if (normalized.includes("referencia de pago")) return "paymentReference";
  if (normalized.includes("cuenta bancaria")) return "bankAccountNumber";
  return null;
}

function invoicePaymentIssues(document: SalesImportInvoicePreviewDocument, accountingEnabled: boolean) {
  const method = normalizeInvoicePaymentMethod(document.source.paymentMethod);
  const supported = invoicePaymentMethodOptions.some((option) => option.value === method);
  const issues: string[] = [];
  if (!supported) issues.push("Selecciona un método de pago válido.");
  if (supported && requiresPaymentReference(method) && !String(document.source.paymentReference || "").trim()) {
    issues.push("La referencia es obligatoria para tarjeta, transferencia o cheque.");
  }
  const bankAccountNumber = String(document.source.bankAccountNumber || "").trim();
  if (supported && isBankPaymentMethod(method, true) && accountingEnabled && !bankAccountNumber) {
    issues.push("Selecciona una cuenta bancaria para Contabilidad.");
  }
  if (supported && !isBankPaymentMethod(method, true) && bankAccountNumber) {
    issues.push("La cuenta bancaria solo aplica a tarjeta, transferencia o cheque.");
  }
  return issues;
}

function isInvoicePaymentIssueResolved(
  document: SalesImportInvoicePreviewDocument,
  field: string | undefined,
  accountingEnabled: boolean,
  initialSource?: SalesImportInvoicePreviewDocument["source"],
) {
  const paymentField = invoicePaymentFieldFromIssue(field);
  if (!paymentField) return false;
  const method = normalizeInvoicePaymentMethod(document.source.paymentMethod);
  if (paymentField === "paymentMethod") {
    return invoicePaymentMethodOptions.some((option) => option.value === method);
  }
  if (paymentField === "paymentReference") {
    return !requiresPaymentReference(method) || Boolean(String(document.source.paymentReference || "").trim());
  }
  if (!isBankPaymentMethod(method, true)) return true;
  const accountNumber = String(document.source.bankAccountNumber || "").trim();
  if (!accountNumber) return !accountingEnabled;
  return Boolean(initialSource && accountNumber !== String(initialSource.bankAccountNumber || "").trim());
}

function invoiceDocumentReady(
  document: SalesImportInvoicePreviewDocument,
  accountingEnabled: boolean,
  initialSource?: SalesImportInvoicePreviewDocument["source"],
) {
  if (["CONFIRMED", "PROCESSING"].includes(document.status)) return false;
  const unresolvedErrors = (document.preview?.errors || []).filter((issue) => {
    return !isInvoicePaymentIssueResolved(document, issue.field, accountingEnabled, initialSource);
  });
  const nonPaymentErrors = unresolvedErrors.some((issue) => !invoicePaymentFieldFromIssue(issue.field));
  return !nonPaymentErrors && unresolvedErrors.length === 0 && invoicePaymentIssues(document, accountingEnabled).length === 0;
}

function clearLegacyInvoiceBatchPointers() {
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (
      key?.startsWith(BATCH_STORAGE_PREFIX) &&
      key.endsWith(":INVOICE")
    )
      localStorage.removeItem(key);
  }
}

interface SalesImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: SalesImportKind;
  tenantId: string;
  register?: CashRegister | null;
  session?: CashRegisterSession | null;
  onFinished?: () => void;
}

function statusLabel(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "READY":
      return "Listo";
    case "BLOCKED":
      return "Con errores";
    case "CONFIRMED":
      return "Confirmado";
    case "FAILED":
      return "Falló";
    case "PROCESSING":
      return "Procesando";
    default:
      return status || "—";
  }
}

function statusClass(status?: string) {
  switch (String(status || "").toUpperCase()) {
    case "READY":
      return "border-primary/20 bg-primary/10 text-primary";
    case "BLOCKED":
    case "FAILED":
      return "border-destructive/20 bg-destructive/10 text-destructive";
    case "CONFIRMED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

function currencyLabel(currency?: string) {
  return currency === "USD" ? "US$" : "C$";
}

function InvoiceImportPreviewSection({
  preview,
  initialSources,
  confirming,
  progress,
  onSourceUpdate,
  onConfirm,
}: {
  preview: SalesImportInvoicePreviewResponse;
  initialSources: Map<number, SalesImportInvoicePreviewDocument["source"]>;
  confirming: boolean;
  progress: { current: number; total: number } | null;
  onSourceUpdate: (sourceRowNumber: number, field: InvoicePaymentField, value: string) => void;
  onConfirm: () => void;
}) {
  const accountingEnabled = Boolean(preview.integrations?.accountingEnabled);
  const readyCount = preview.documents.filter((document) => invoiceDocumentReady(
    document,
    accountingEnabled,
    initialSources.get(document.sourceRowNumber),
  )).length;
  const confirmedCount = preview.documents.filter(
    (document) => document.status === "CONFIRMED",
  ).length;
  const errorCount = preview.documents.filter(
    (document) => !invoiceDocumentReady(document, accountingEnabled, initialSources.get(document.sourceRowNumber)) && !["CONFIRMED", "PROCESSING"].includes(document.status),
  ).length;

  return (
    <section className="min-w-0 space-y-4" aria-live="polite">
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-black">3. Vista previa y confirmación</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {preview.summary.total} factura(s) · {readyCount} lista(s) · {errorCount} con errores · {confirmedCount} confirmada(s)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Puedes ajustar método, referencia y cuenta bancaria por factura; el servidor vuelve a validar al confirmar.</p>
          {progress && (
            <p className="mt-1 text-xs font-semibold text-primary" role="status">
              Confirmando factura {progress.current} de {progress.total}…
            </p>
          )}
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-2 rounded-xl"
          disabled={confirming || readyCount === 0}
          onClick={onConfirm}
        >
          {confirming ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {confirming ? "Confirmando…" : `Confirmar ${readyCount} factura(s)`}
        </Button>
      </div>

      {Boolean(preview.globalErrors.length) && (
        <div
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
          role="alert"
        >
          {preview.globalErrors.map((issue, index) => (
            <p key={`${issue.rowNumber || "global"}-${index}`}>
              {issue.rowNumber ? `Fila ${issue.rowNumber}: ` : ""}
              {issue.message}
            </p>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {preview.documents.map((document) => (
          <InvoiceImportDocumentCard
            key={document.sourceRowNumber}
            document={document}
            initialSource={initialSources.get(document.sourceRowNumber)}
            accountingEnabled={accountingEnabled}
            financeEnabled={Boolean(preview.integrations?.financeEnabled)}
            confirming={confirming}
            onSourceUpdate={onSourceUpdate}
          />
        ))}
      </div>
    </section>
  );
}

function InvoiceImportDocumentCard({
  document,
  initialSource,
  accountingEnabled,
  financeEnabled,
  confirming,
  onSourceUpdate,
}: {
  document: SalesImportInvoicePreviewDocument;
  initialSource?: SalesImportInvoicePreviewDocument["source"];
  accountingEnabled: boolean;
  financeEnabled: boolean;
  confirming: boolean;
  onSourceUpdate: (sourceRowNumber: number, field: InvoicePaymentField, value: string) => void;
}) {
  const data = document.preview;
  const method = normalizeInvoicePaymentMethod(document.source.paymentMethod);
  const ready = invoiceDocumentReady(document, accountingEnabled, initialSource);
  const canEditPayment = !confirming && !["CONFIRMED", "PROCESSING"].includes(document.status);
  const visibleErrors = (data?.errors || []).filter((issue) => {
    return !isInvoicePaymentIssueResolved(document, issue.field, accountingEnabled, initialSource);
  });
  return (
    <details className="group min-w-0 rounded-2xl border border-border/60 bg-card p-4 open:border-primary/30">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <span className="min-w-0 flex-1 break-all text-sm font-black">
          {document.reference}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {document.lineCount} línea(s)
        </span>
        <Badge variant="outline" className={statusClass(ready && document.status === "BLOCKED" ? "READY" : document.status)}>
          {ready && document.status === "BLOCKED" ? "Listo" : statusLabel(document.status)}
        </Badge>
        {document.result?.invoiceNumber && (
          <Badge variant="outline" className="font-mono text-[10px]">
            {document.result.invoiceNumber}
          </Badge>
        )}
        {data?.totals?.total !== undefined && (
          <span className="w-full text-right text-sm font-black text-primary sm:w-auto">
            {currencyLabel(data.currency)}{" "}
            {Number(data.totals.total).toLocaleString("es-NI", {
              minimumFractionDigits: 2,
            })}
          </span>
        )}
      </summary>
      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <span>Cliente: <strong className="text-foreground">{data?.customerName || "—"}</strong></span>
            <span>Fecha: <strong className="text-foreground">{data?.date || "—"}</strong></span>
            <span>Pago: <strong className="text-foreground">{paymentMethodLabel(method)}</strong></span>
          </div>
          <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <label className="min-w-0 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Método de pago</span>
              <Select
                value={method}
                onValueChange={(value) => {
                  onSourceUpdate(document.sourceRowNumber, "paymentMethod", value);
                  if (value === "CASH") {
                    onSourceUpdate(document.sourceRowNumber, "paymentReference", "");
                    onSourceUpdate(document.sourceRowNumber, "bankAccountNumber", "");
                  }
                }}
                disabled={!canEditPayment}
              >
                <SelectTrigger aria-label={`Método de pago de la factura ${document.reference}`} className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {!invoicePaymentMethodOptions.some((option) => option.value === method) && <SelectItem value={method}>Valor importado: {method}</SelectItem>}
                  {invoicePaymentMethodOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            {hasPaymentReferenceField(method) && (
              <label className="min-w-0 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Referencia de pago{requiresPaymentReference(method) ? " *" : ""}</span>
                <Input
                  aria-label={`Referencia de pago de la factura ${document.reference}`}
                  value={String(document.source.paymentReference || "")}
                  onChange={(event) => onSourceUpdate(document.sourceRowNumber, "paymentReference", event.target.value)}
                  disabled={!canEditPayment}
                  maxLength={120}
                  className="h-9 text-xs"
                />
              </label>
            )}
            {isBankPaymentMethod(method, true) && (accountingEnabled || financeEnabled) && (
              <BankAccountSelect
                label="Número de cuenta bancaria"
                placeholder="Seleccionar cuenta existente"
                required={accountingEnabled}
                valueMode="accountNumber"
                allowUnlinked={!accountingEnabled}
                currency={String(data?.currency || document.source.currency || "")}
                value={String(document.source.bankAccountNumber || "")}
                onChange={(value) => onSourceUpdate(document.sourceRowNumber, "bankAccountNumber", value)}
                disabled={!canEditPayment}
                className="min-w-0"
              />
            )}
          </div>
          {isBankPaymentMethod(method, true) && !accountingEnabled && !financeEnabled && (
            <p className="text-[10px] text-muted-foreground">Las conexiones de Finanzas y Contabilidad están desactivadas; se registrará el método y la referencia sin movimiento bancario.</p>
          )}
          {invoicePaymentIssues(document, accountingEnabled).map((issue, index) => (
            <p key={`payment-issue-${index}`} role="alert" className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive">{issue}</p>
          ))}
          <div className="overflow-x-auto rounded-xl border border-border/50">
            <table className="w-full min-w-[840px] text-left text-xs">
              <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="p-2">Producto / SKU</th>
                  <th className="p-2">Lista de precios</th>
                  <th className="p-2">Cantidad</th>
                  <th className="p-2">Precio</th>
                  <th className="p-2">Desc.</th>
                  <th className="p-2">IVA</th>
                  <th className="p-2">Bodega</th>
                  <th className="p-2">Disponible al prever</th>
                </tr>
              </thead>
              <tbody>
                {data?.items?.map((item, index) => (
                  <tr key={`${item.sourceRowNumber || index}-${item.productCode}`} className="border-t border-border/50">
                    <td className="max-w-[240px] break-words p-2">
                      <span className="font-semibold">{item.description || "Producto"}</span>
                      <span className="block text-[10px] text-muted-foreground">{item.productCode}</span>
                    </td>
                    <td className="max-w-[180px] break-words p-2">
                      {item.itemType?.toUpperCase() === "SERVICE" ? "Catálogo" : item.priceListName || "Predeterminada"}
                    </td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{currencyLabel(data.currency)} {Number(item.unitPrice || 0).toLocaleString("es-NI", { minimumFractionDigits: 2 })}</td>
                    <td className="p-2">{Number(item.discount || 0)}%</td>
                    <td className="p-2">{Number(item.taxRate || 0)}%</td>
                    <td className="p-2">{item.warehouseName || "Servicio"}</td>
                    <td className="p-2">
                      {item.availableStock === null || !item.warehouseName
                        ? "—"
                        : item.availableStock === undefined
                          ? "No disponible"
                          : Number(item.availableStock).toLocaleString("es-NI")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          {document.error && !ready && (
            <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive">
              <strong>{document.status === "FAILED" ? "Error al confirmar" : "Debe corregirse"}</strong>
              <p className="mt-1 whitespace-pre-wrap">{document.error}</p>
            </div>
          )}
          {document.result?.postCommitWarning && (
            <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground">
              <strong>La factura quedó registrada; falta completar un proceso posterior.</strong>
              <p className="mt-1 whitespace-pre-wrap">{document.result.postCommitWarning}</p>
              <p className="mt-1 text-muted-foreground">La factura no se volverá a crear al reintentar el mismo intento.</p>
            </div>
          )}
          {visibleErrors.map((issue, index) => (
            <div key={`error-${index}`} className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive">
              <strong>{issue.field || "Error"}{issue.rowNumber ? ` · fila ${issue.rowNumber}` : ""}:</strong> {issue.message}
            </div>
          ))}
          {data?.warnings?.map((warning, index) => (
            <div key={`warning-${index}`} className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-foreground">
              <p className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span><strong>{warning.field || "Aviso"}:</strong> {warning.message}</span>
              </p>
            </div>
          ))}
          {document.status === "CONFIRMED" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4 shrink-0" />
              Factura registrada como pagada.
            </div>
          )}
        </div>
      </div>
    </details>
  );
}

export function SalesImportWizard({
  open,
  onOpenChange,
  kind,
  tenantId,
  register,
  session,
  onFinished,
}: SalesImportWizardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [batch, setBatch] = useState<SalesImportBatch | null>(null);
  const [invoicePreview, setInvoicePreview] =
    useState<SalesImportInvoicePreviewResponse | null>(null);
  const [invoiceAttemptId, setInvoiceAttemptId] = useState<string | null>(null);
  const initialInvoiceSourcesRef = useRef(new Map<number, SalesImportInvoicePreviewDocument["source"]>());
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [workingBlock, setWorkingBlock] = useState<number | null>(null);
  const [confirmingInvoices, setConfirmingInvoices] = useState(false);
  const [invoiceProgress, setInvoiceProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [duplicatePrompt, setDuplicatePrompt] = useState(false);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [invoiceRegisterId, setInvoiceRegisterId] = useState(NO_REGISTER);
  const [invoiceSessionState, setInvoiceSessionState] = useState<{
    registerId: string;
    session: CashRegisterSession | null;
  } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const storageKey = `${BATCH_STORAGE_PREFIX}${tenantId}:${kind}`;
  const activeRegister =
    kind === "POS"
      ? register
      : registers.find((item) => item.id === invoiceRegisterId) || null;
  const invoiceSession =
    invoiceSessionState?.registerId === invoiceRegisterId
      ? invoiceSessionState.session
      : null;
  const sessionLoading =
    invoiceRegisterId !== NO_REGISTER &&
    invoiceSessionState?.registerId !== invoiceRegisterId;
  const activeSession = kind === "POS" ? session : invoiceSession;
  const contextReady =
    kind === "POS"
      ? Boolean(register?.id && session?.id && session.status === "OPEN")
      : invoiceRegisterId === NO_REGISTER ||
        Boolean(
          activeRegister?.id &&
          activeSession?.id &&
          activeSession.status === "OPEN",
        );

  useEffect(() => {
    if (!open || kind !== "INVOICE") return;
    let cancelled = false;
    cajaService
      .getRegisters()
      .then((items) => {
        if (!cancelled)
          setRegisters(
            items.filter(
              (item) =>
                item.isActive &&
                item.hasActiveSession &&
                item.activeSessionStatus === "OPEN",
            ),
          );
      })
      .catch(() => {
        if (!cancelled) setRegisters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind]);

  useEffect(() => {
    if (!open || kind !== "INVOICE" || invoiceRegisterId === NO_REGISTER)
      return;
    let cancelled = false;
    cajaService
      .getActiveSession(invoiceRegisterId)
      .then((current) => {
        if (!cancelled)
          setInvoiceSessionState({
            registerId: invoiceRegisterId,
            session: current?.status === "OPEN" ? current : null,
          });
      })
      .catch(() => {
        if (!cancelled)
          setInvoiceSessionState({
            registerId: invoiceRegisterId,
            session: null,
          });
      });
    return () => {
      cancelled = true;
    };
  }, [open, kind, invoiceRegisterId]);

  useEffect(() => {
    if (!open || kind !== "POS" || !tenantId) return;
    let cancelled = false;
    const lastBatchId = localStorage.getItem(storageKey);
    if (!lastBatchId) return;
    salesImportService
      .getBatch(kind, lastBatchId, 1)
      .then((loaded) => {
        if (!cancelled) {
          if (!shouldRestoreSalesImportBatch(loaded)) {
            localStorage.removeItem(storageKey);
            setBatch(null);
            setPage(1);
            setLoadError(null);
            return;
          }
          setBatch(loaded);
          setPage(1);
        }
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(storageKey);
          setBatch(null);
          setPage(1);
          setLoadError(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, kind, storageKey]);

  useEffect(() => {
    if (kind !== "INVOICE") return;
    // Remove the legacy invoice pointer once; new invoice state is never stored.
    clearLegacyInvoiceBatchPointers();
    setBatch(null);
    setPage(1);
    setInvoicePreview(null);
    initialInvoiceSourcesRef.current.clear();
    setInvoiceAttemptId(null);
    setInvoiceProgress(null);
    setLoadError(null);
    setDuplicatePrompt(false);
    setFile(null);
  }, [open, kind, tenantId, storageKey]);

  const setBatchAndPersist = (next: SalesImportBatch) => {
    if (kind !== "POS") return;
    setBatch(next);
    setPage(next.page?.page || 1);
    localStorage.setItem(storageKey, next.batchId);
  };

  const currentContext = {
    ...(activeRegister?.id && activeSession?.id
      ? { registerId: activeRegister.id, sessionId: activeSession.id }
      : {}),
  };

  const runPreview = async (allowDuplicateContent = false) => {
    if (!file) {
      toast.error("Selecciona el archivo XLSX que deseas cargar.");
      return;
    }
    if (!contextReady) {
      toast.error(
        kind === "POS"
          ? "La caja y su sesión deben permanecer abiertas para importar."
          : "Espera a que se verifique la sesión de caja seleccionada.",
      );
      return;
    }
    setBusy(true);
    setBatch(null);
    setInvoicePreview(null);
    setPage(1);
    setLoadError(null);
    setDuplicatePrompt(false);
    if (kind === "POS") localStorage.removeItem(storageKey);
    try {
      const response = await salesImportService.preview(kind, file, {
        ...currentContext,
        ...(kind === "POS" ? { allowDuplicateContent } : {}),
      });
      if (kind === "INVOICE") {
        if (!("kind" in response) || response.kind !== "INVOICE") {
          setLoadError("El servidor no devolvió una vista previa de facturas válida.");
          return;
        }
        const invoiceResponse = response as SalesImportInvoicePreviewResponse;
        initialInvoiceSourcesRef.current = new Map(invoiceResponse.documents.map((document) => [
          document.sourceRowNumber,
          { ...document.source },
        ]));
        setInvoicePreview(invoiceResponse);
        setInvoiceAttemptId(crypto.randomUUID());
        toast.success(
          `Vista previa lista: ${invoiceResponse.summary.total} documento(s).`,
        );
        return;
      }
      const legacyResponse = response as SalesImportPreviewResponse;
      if (legacyResponse.requiresDuplicateConfirmation) {
        setDuplicatePrompt(true);
        return;
      }
      if (!shouldRestoreSalesImportBatch(legacyResponse)) {
        setLoadError(
          legacyResponse.globalErrors?.[0]?.message ||
            "La vista previa falló. Corrige el archivo e inténtalo de nuevo.",
        );
        return;
      }
      if (
        !legacyResponse.batchId ||
        !legacyResponse.summary ||
        !legacyResponse.documents
      ) {
        setLoadError(
          "El servidor no devolvió una vista previa de lote válida.",
        );
        return;
      }
      setBatchAndPersist(legacyResponse as SalesImportBatch);
      toast.success(
        `Vista previa lista: ${legacyResponse.summary.total} documento(s).`,
      );
    } catch (error) {
      setLoadError(
        getApiErrorMessage(error, "No se pudo cargar o analizar el archivo."),
      );
    } finally {
      setBusy(false);
    }
  };

  const loadPage = async (nextPage: number) => {
    if (
      !batch ||
      nextPage < 1 ||
      nextPage > Math.ceil(batch.page.total / batch.page.pageSize)
    )
      return;
    setBusy(true);
    try {
      const loaded = await salesImportService.getBatch(
        kind,
        batch.batchId,
        nextPage,
      );
      setBatch(loaded);
      setPage(loaded.page.page);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No se pudo actualizar la vista previa."),
      );
    } finally {
      setBusy(false);
    }
  };

  const updateInvoiceSource = (sourceRowNumber: number, field: InvoicePaymentField, value: string) => {
    setInvoicePreview((current) => current ? {
      ...current,
      documents: current.documents.map((document) => document.sourceRowNumber === sourceRowNumber
        ? { ...document, source: { ...document.source, [field]: value } }
        : document),
    } : current);
    setInvoiceAttemptId(crypto.randomUUID());
  };

  const confirmBlock = async (blockNumber: number) => {
    if (kind !== "POS") return;
    if (!batch || workingBlock !== null) return;
    setWorkingBlock(blockNumber);
    try {
      const result = await salesImportService.confirmBlock(
        kind,
        batch.batchId,
        blockNumber,
      );
      if (result.batch) setBatchAndPersist(result.batch);
      const failed = result.documents.filter(
        (document) => document.status === "FAILED",
      );
      const succeeded = result.documents.filter(
        (document) => document.status === "CONFIRMED",
      );
      if (failed.length)
        toast.error(
          `${failed.length} documento(s) fallaron. Revisa el motivo en el bloque.`,
        );
      else toast.success(`${succeeded.length} documento(s) confirmados.`);
      if (succeeded.length) onFinished?.();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "No se pudo confirmar el bloque."));
    } finally {
      setWorkingBlock(null);
    }
  };

  const confirmInvoices = async () => {
    if (kind !== "INVOICE" || !invoicePreview || !invoiceAttemptId || confirmingInvoices)
      return;
    const readyDocuments = invoicePreview.documents.filter((document) => invoiceDocumentReady(
      document,
      Boolean(invoicePreview.integrations?.accountingEnabled),
      initialInvoiceSourcesRef.current.get(document.sourceRowNumber),
    ));
    if (!readyDocuments.length) {
      toast.error("No hay facturas listas para confirmar.");
      return;
    }
    setConfirmingInvoices(true);
    setInvoiceProgress({ current: 0, total: readyDocuments.length });
    let succeeded = 0;
    for (const [index, document] of readyDocuments.entries()) {
      setInvoiceProgress({ current: index + 1, total: readyDocuments.length });
      setInvoicePreview((current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((item) =>
                item.sourceRowNumber === document.sourceRowNumber
                  ? { ...item, status: "PROCESSING", error: null }
                  : item,
              ),
            }
          : current,
      );
      try {
        const result = await salesImportService.confirmInvoiceDocument(
          invoiceAttemptId,
          document.source,
          currentContext,
        );
        succeeded += 1;
        setInvoicePreview((current) =>
          current
            ? {
                ...current,
                documents: current.documents.map((item) =>
                  item.sourceRowNumber === document.sourceRowNumber
                    ? {
                        ...item,
                        status: "CONFIRMED",
                        error: null,
                        result: {
                          invoiceNumber: result.invoiceNumber,
                          total: result.total,
                          currency: result.currency,
                          postCommitWarning: result.postCommitWarning,
                        },
                      }
                    : item,
                ),
              }
            : current,
        );
      } catch (error) {
        setInvoicePreview((current) =>
          current
            ? {
                ...current,
                documents: current.documents.map((item) =>
                  item.sourceRowNumber === document.sourceRowNumber
                    ? {
                        ...item,
                        status: "FAILED",
                        error: getApiErrorMessage(
                          error,
                          "No se pudo confirmar esta factura.",
                        ),
                      }
                    : item,
                ),
              }
            : current,
        );
      }
    }
    setConfirmingInvoices(false);
    setInvoiceProgress(null);
    if (succeeded) {
      toast.success(`${succeeded} factura(s) confirmada(s).`);
      onFinished?.();
    }
    if (succeeded < readyDocuments.length)
      toast.error(
        `${readyDocuments.length - succeeded} factura(s) fallaron. Revisa cada resultado y vuelve a intentar si corresponde.`,
      );
  };

  const downloadTemplate = async () => {
    try {
      const { downloadSalesImportTemplate } =
        await import("./sales-import-template");
      await downloadSalesImportTemplate(kind);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "No se pudo generar la plantilla Excel."),
      );
    }
  };

  const pageCount = batch
    ? Math.max(1, Math.ceil(batch.page.total / batch.page.pageSize))
    : 1;
  const isComplete = batch?.status === "COMPLETED";

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!busy && workingBlock === null && !confirmingInvoices) {
          if (!nextOpen && kind === "INVOICE") {
            setFile(null);
            setInvoicePreview(null);
            setInvoiceAttemptId(null);
            setInvoiceProgress(null);
            setLoadError(null);
          }
          onOpenChange(nextOpen);
        }
      }}
    >
      <DialogContent className="!max-h-[min(92dvh,980px)] w-[calc(100%-1rem)] !max-w-6xl gap-0 overflow-hidden p-0 sm:w-[calc(100%-2rem)]">
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 py-4 pr-12 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight sm:text-xl">
                <FileSpreadsheet className="size-5 shrink-0 text-primary" />
                Importar {kind === "POS" ? "ventas de Caja" : "facturas"}
              </DialogTitle>
              <DialogDescription className="mt-2 max-w-3xl">
                Carga la plantilla, revisa los precios y existencias, y confirma
                {kind === "INVOICE" ? " cada factura." : " cada bloque."} Cada documento se registra como pagado en efectivo.
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-9 shrink-0 gap-2 rounded-xl"
              onClick={() => void downloadTemplate()}
            >
              <Download className="size-4" /> Plantilla Excel
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
            <section className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-card p-4">
              <div>
                <h3 className="text-sm font-black">1. Prepara el archivo</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Completa las hojas Documentos y Detalle. No agregues precios
                  ni importes de pago. El límite técnico es configurable; el
                  valor inicial del servidor es 50 MB.
                </p>
              </div>
              <Label htmlFor={`sales-import-file-${kind}`} className="sr-only">
                Archivo Excel de facturas
              </Label>
              <input
                id={`sales-import-file-${kind}`}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="block w-full min-w-0 cursor-pointer rounded-xl border border-border/70 bg-background px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                onChange={(event) => {
                  setFile(event.target.files?.[0] || null);
                  setBatch(null);
                  setInvoicePreview(null);
                  setInvoiceAttemptId(null);
                  setInvoiceProgress(null);
                  setPage(1);
                  setLoadError(null);
                  setDuplicatePrompt(false);
                  if (kind === "POS") localStorage.removeItem(storageKey);
                }}
                disabled={busy || workingBlock !== null || confirmingInvoices}
              />
              {file && (
                <p className="break-all text-xs text-muted-foreground">
                  {file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              )}
              <Button
                type="button"
                className="w-full gap-2 rounded-xl font-bold sm:w-auto"
                onClick={() => void runPreview()}
                disabled={busy || confirmingInvoices || !file || !contextReady}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {busy ? "Cargando y analizando…" : "Cargar y ver vista previa"}
              </Button>
              {kind === "POS" && duplicatePrompt && (
                <div
                  className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3"
                  role="alert"
                >
                  <p className="text-sm font-semibold text-foreground">{`El mismo archivo ya tiene un lote en otro contexto. ¿Quieres iniciar una carga nueva?`}</p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-2 border-amber-600/40"
                    onClick={() => void runPreview(true)}
                    disabled={busy}
                  >
                    <AlertTriangle className="size-4" /> Confirmar nueva carga
                  </Button>
                </div>
              )}
              {loadError && (
                <p
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                >
                  {loadError}
                </p>
              )}
            </section>

            <section className="min-w-0 space-y-3 rounded-2xl border border-border/60 bg-card p-4">
              <div>
                <h3 className="text-sm font-black">2. Contexto de operación</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  La carga solo aplica a la sucursal de tu sesión. El cliente
                  vacío del Excel usa el Cliente General configurado para esa
                  sucursal.
                </p>
              </div>
              {kind === "POS" ? (
                <div className="rounded-xl border border-primary/20 bg-primary/[0.05] p-3">
                  <p className="text-xs font-bold text-foreground">
                    Caja: {register?.name || "Sin caja seleccionada"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sesión:{" "}
                    {session?.status === "OPEN"
                      ? "Abierta y lista para importar"
                      : "No hay una sesión abierta"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label
                    htmlFor="sales-import-cash-session"
                    className="text-xs font-semibold"
                  >
                    Asociar pago a una caja abierta (opcional)
                  </Label>
                  <Select
                    value={invoiceRegisterId}
                    onValueChange={setInvoiceRegisterId}
                    disabled={busy || workingBlock !== null || confirmingInvoices}
                  >
                    <SelectTrigger
                      id="sales-import-cash-session"
                      className="w-full rounded-xl"
                    >
                      <SelectValue placeholder="Sin asociar a sesión de Caja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_REGISTER}>
                        Sin asociar a sesión
                      </SelectItem>
                      {registers.map((cashRegister) => (
                        <SelectItem
                          key={cashRegister.id}
                          value={cashRegister.id}
                        >
                          {cashRegister.code} · {cashRegister.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {invoiceRegisterId !== NO_REGISTER && (
                    <p
                      className="text-xs text-muted-foreground"
                      aria-live="polite"
                    >
                      {sessionLoading
                        ? "Verificando sesión abierta…"
                        : invoiceSession?.status === "OPEN"
                          ? "El pago quedará registrado también en la sesión seleccionada."
                          : "Esta caja no tiene una sesión abierta."}
                    </p>
                  )}
                  {invoiceRegisterId === NO_REGISTER && (
                    <p className="text-xs text-muted-foreground">
                      El pago seguirá asociado a la factura y a finanzas, sin
                      registro de sesión de caja.
                    </p>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">
                <p className="font-bold text-foreground">
                  Qué ocurrirá al confirmar
                </p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  <li>El número oficial lo genera NovaHub.</li>
                  <li>Se vuelve a comprobar el precio y el inventario.</li>
                  <li>El total calculado se registra como pagado con el método indicado en cada factura.</li>
                  <li>Tarjeta, transferencia y cheque requieren referencia; la cuenta bancaria se valida para esta sucursal.</li>
                  <li>Un error no revierte otros documentos confirmados.</li>
                </ul>
              </div>
            </section>
          </div>

          {kind === "INVOICE" && invoicePreview && (
            <InvoiceImportPreviewSection
              preview={invoicePreview}
              initialSources={initialInvoiceSourcesRef.current}
              confirming={confirmingInvoices}
              progress={invoiceProgress}
              onSourceUpdate={updateInvoiceSource}
              onConfirm={() => void confirmInvoices()}
            />
          )}

          {kind === "POS" && batch && (
            <section className="min-w-0 space-y-4" aria-live="polite">
              <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-black">
                      3. Vista previa y confirmación
                    </h3>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {batch.batchId.slice(0, 8)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {batch.status === "COMPLETED"
                        ? "Completado"
                        : batch.status === "COMPLETED_WITH_ERRORS"
                          ? "Completado con errores"
                          : batch.status === "PARTIAL"
                            ? "Parcial"
                            : batch.status === "PROCESSING"
                              ? "Procesando"
                              : "Vista previa"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {batch.summary.total} documento(s) · {batch.summary.ready}{" "}
                    listo(s) · {batch.summary.blocked} con errores ·{" "}
                    {batch.summary.completed} confirmado(s) ·{" "}
                    {batch.summary.failed +
                      (batch.summary.postCommitRetryable || 0)}{" "}
                    por reintentar
                    {batch.summary.postCommitProcessing
                      ? ` · ${batch.summary.postCommitProcessing} efecto(s) posterior(es) en proceso`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-2 rounded-xl"
                  onClick={() => void loadPage(page)}
                  disabled={busy}
                >
                  <RefreshCw
                    className={`size-3.5 ${busy ? "animate-spin" : ""}`}
                  />{" "}
                  Actualizar
                </Button>
              </div>

              {Boolean(batch.globalErrors?.length) && (
                <div
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  role="alert"
                >
                  {batch.globalErrors?.map((issue, index) => (
                    <p key={`${issue.rowNumber || "global"}-${index}`}>
                      {issue.rowNumber ? `Fila ${issue.rowNumber}: ` : ""}
                      {issue.message}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {batch.summary.blocks.map((block) => {
                  const canConfirm =
                    block.ready +
                      block.failed +
                      (block.postCommitRetryable || 0) >
                    0;
                  return (
                    <div
                      key={block.blockNumber}
                      className="min-w-0 rounded-2xl border border-border/60 bg-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black">
                            Bloque {block.blockNumber}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {block.total} documento(s) · {block.ready} listo(s)
                            · {block.blocked} bloqueado(s) · {block.confirmed}{" "}
                            confirmado(s)
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="shrink-0 rounded-xl"
                          disabled={
                            !canConfirm || workingBlock !== null || isComplete
                          }
                          onClick={() => void confirmBlock(block.blockNumber)}
                        >
                          {workingBlock === block.blockNumber ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-4" />
                          )}
                          <span className="ml-1">
                            {workingBlock === block.blockNumber
                              ? "Procesando…"
                              : block.confirmed
                                ? "Continuar"
                                : "Confirmar"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-3">
                {batch.documents.map((doc) => {
                  const preview = doc.preview;
                  return (
                    <details
                      key={`${doc.reference}-${doc.sourceRowNumber}`}
                      className="group min-w-0 rounded-2xl border border-border/60 bg-card p-4 open:border-primary/30"
                    >
                      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                        <span className="min-w-0 flex-1 break-all text-sm font-black">
                          {doc.reference}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Bloque {doc.blockNumber} · {doc.lineCount} línea(s)
                        </span>
                        <Badge
                          variant="outline"
                          className={statusClass(doc.status)}
                        >
                          {statusLabel(doc.status)}
                        </Badge>
                        {doc.result?.invoiceNumber && (
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px]"
                          >
                            {doc.result.invoiceNumber}
                          </Badge>
                        )}
                        {preview?.totals?.total !== undefined && (
                          <span className="w-full text-right text-sm font-black text-primary sm:w-auto">
                            {currencyLabel(preview.currency)}{" "}
                            {Number(preview.totals.total).toLocaleString(
                              "es-NI",
                              { minimumFractionDigits: 2 },
                            )}
                          </span>
                        )}
                      </summary>
                      <div className="mt-4 grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(240px,0.55fr)]">
                        <div className="min-w-0 space-y-3">
                          <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                            <span>
                              Cliente:{" "}
                              <strong className="text-foreground">
                                {preview?.customerName || "—"}
                              </strong>
                            </span>
                            <span>
                              Fecha:{" "}
                              <strong className="text-foreground">
                                {preview?.date || "—"}
                              </strong>
                            </span>
                            <span>
                              Pago:{" "}
                              <strong className="text-foreground">
                                Efectivo
                              </strong>
                            </span>
                          </div>
                          <div className="overflow-x-auto rounded-xl border border-border/50">
                            <table className="w-full min-w-[840px] text-left text-xs">
                              <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                                <tr>
                                  <th className="p-2">Producto / SKU</th>
                                  <th className="p-2">Lista de precios</th>
                                  <th className="p-2">Cantidad</th>
                                  <th className="p-2">Precio</th>
                                  <th className="p-2">Desc.</th>
                                  <th className="p-2">IVA</th>
                                  <th className="p-2">Bodega</th>
                                  <th className="p-2">Disponible al prever</th>
                                </tr>
                              </thead>
                              <tbody>
                                {preview?.items?.map((item, index) => (
                                  <tr
                                    key={`${item.sourceRowNumber || index}-${item.productCode}`}
                                    className="border-t border-border/50"
                                  >
                                    <td className="max-w-[240px] break-words p-2">
                                      <span className="font-semibold">
                                        {item.description || "Producto"}
                                      </span>
                                      <span className="block text-[10px] text-muted-foreground">
                                        {item.productCode}
                                      </span>
                                    </td>
                                    <td className="max-w-[180px] break-words p-2">
                                      {item.itemType?.toUpperCase() === "SERVICE"
                                        ? "Catálogo"
                                        : item.priceListName || "Predeterminada"}
                                    </td>
                                    <td className="p-2">{item.quantity}</td>
                                    <td className="p-2">
                                      {currencyLabel(preview.currency)}{" "}
                                      {Number(
                                        item.unitPrice || 0,
                                      ).toLocaleString("es-NI", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </td>
                                    <td className="p-2">
                                      {Number(item.discount || 0)}%
                                    </td>
                                    <td className="p-2">
                                      {Number(item.taxRate || 0)}%
                                    </td>
                                    <td className="p-2">
                                      {item.warehouseName || "Servicio"}
                                    </td>
                                    <td className="p-2">
                                      {item.availableStock === null ||
                                      !item.warehouseName
                                        ? "—"
                                        : item.availableStock === undefined
                                          ? "No disponible"
                                          : Number(
                                              item.availableStock,
                                            ).toLocaleString("es-NI")}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <div className="min-w-0 space-y-2">
                          {doc.error && (
                            <div
                              role="alert"
                              className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-xs text-destructive"
                            >
                              <strong>
                                {doc.status === "FAILED"
                                  ? "Error al confirmar"
                                  : "Debe corregirse"}
                              </strong>
                              <p className="mt-1 whitespace-pre-wrap">
                                {doc.error}
                              </p>
                            </div>
                          )}
                          {doc.result?.postCommitWarning && (
                            <div
                              role="alert"
                              className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-foreground"
                            >
                              <strong>
                                La factura quedó registrada; falta completar un
                                proceso posterior.
                              </strong>
                              <p className="mt-1 whitespace-pre-wrap">
                                {doc.result.postCommitWarning}
                              </p>
                              <p className="mt-1 text-muted-foreground">
                                Puedes reintentar desde el bloque sin crear otra
                                factura.
                              </p>
                            </div>
                          )}
                          {preview?.errors?.map((issue, index) => (
                            <div
                              key={`error-${index}`}
                              className="rounded-lg bg-destructive/5 p-2 text-xs text-destructive"
                            >
                              <strong>
                                {issue.field || "Error"}
                                {issue.rowNumber
                                  ? ` · fila ${issue.rowNumber}`
                                  : ""}
                                :
                              </strong>{" "}
                              {issue.message}
                            </div>
                          ))}
                          {preview?.warnings?.map((warning, index) => (
                            <div
                              key={`warning-${index}`}
                              className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-foreground"
                            >
                              <p className="flex items-start gap-2">
                                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                                <span>
                                  <strong>{warning.field || "Aviso"}:</strong>{" "}
                                  {warning.message}
                                </span>
                              </p>
                              {warning.matches?.map((match) => (
                                <p
                                  key={match.number}
                                  className="mt-2 pl-6 text-muted-foreground"
                                >
                                  {match.number} ·{" "}
                                  {currencyLabel(match.currency)}{" "}
                                  {Number(match.total).toLocaleString("es-NI", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                              ))}
                            </div>
                          ))}
                          {doc.status === "CONFIRMED" && (
                            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="size-4 shrink-0" />
                              Factura registrada como{" "}
                              {doc.result?.status === "PAID"
                                ? "pagada"
                                : doc.result?.status || "confirmada"}
                              .
                            </div>
                          )}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {pageCount} · {batch.page.total} documento(s)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-xl"
                    disabled={page <= 1 || busy}
                    onClick={() => void loadPage(page - 1)}
                  >
                    <ChevronLeft className="size-4" /> Anterior
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1 rounded-xl"
                    disabled={page >= pageCount || busy}
                    onClick={() => void loadPage(page + 1)}
                  >
                    Siguiente <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
            </section>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border/60 px-4 py-3 sm:px-6">
          <div className="flex w-full flex-col gap-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex items-center gap-1.5">
              <CircleAlert className="size-3.5" /> La vista previa no descuenta
              existencias ni registra pagos.
            </span>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => onOpenChange(false)}
              disabled={busy || workingBlock !== null || confirmingInvoices}
            >
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
