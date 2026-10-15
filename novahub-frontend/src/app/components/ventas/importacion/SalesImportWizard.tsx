import { useEffect, useState } from "react";
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
  type SalesImportKind,
} from "../../../services/sales-import.service";
import { toast } from "@/app/services/toast";
import { getApiErrorMessage } from "../../../services/api";

const NO_REGISTER = "__no_cash_session__";
const BATCH_STORAGE_PREFIX = "novahub-sales-import-batch:";

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
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [workingBlock, setWorkingBlock] = useState<number | null>(null);
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
    if (!open || !tenantId) return;
    let cancelled = false;
    const lastBatchId = localStorage.getItem(storageKey);
    if (!lastBatchId) return;
    salesImportService
      .getBatch(kind, lastBatchId, 1)
      .then((loaded) => {
        if (!cancelled) {
          setBatch(loaded);
          setPage(1);
        }
      })
      .catch(() => {
        if (!cancelled) localStorage.removeItem(storageKey);
      });
    return () => {
      cancelled = true;
    };
  }, [open, tenantId, kind, storageKey]);

  const setBatchAndPersist = (next: SalesImportBatch) => {
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
    setLoadError(null);
    setDuplicatePrompt(false);
    try {
      const response = await salesImportService.preview(kind, file, {
        ...currentContext,
        allowDuplicateContent,
      });
      if (response.requiresDuplicateConfirmation) {
        setDuplicatePrompt(true);
        return;
      }
      if (!response.batchId || !response.summary || !response.documents) {
        setLoadError(
          "El servidor no devolvió una vista previa de lote válida.",
        );
        return;
      }
      setBatchAndPersist(response as SalesImportBatch);
      toast.success(
        `Vista previa lista: ${response.summary.total} documento(s).`,
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

  const confirmBlock = async (blockNumber: number) => {
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
        if (!busy && workingBlock === null) onOpenChange(nextOpen);
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
                cada bloque. Cada documento se registra como pagado en efectivo.
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
                  setDuplicatePrompt(false);
                }}
                disabled={busy || workingBlock !== null}
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
                disabled={busy || !file || !contextReady}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {busy ? "Cargando y analizando…" : "Cargar y ver vista previa"}
              </Button>
              {duplicatePrompt && (
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
                    disabled={busy || workingBlock !== null}
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
                  <li>El total calculado se registra como pago en efectivo.</li>
                  <li>Un error no revierte otros documentos confirmados.</li>
                </ul>
              </div>
            </section>
          </div>

          {batch && (
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
                            <table className="w-full min-w-[720px] text-left text-xs">
                              <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                                <tr>
                                  <th className="p-2">Producto / SKU</th>
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
              disabled={busy || workingBlock !== null}
            >
              Cerrar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
