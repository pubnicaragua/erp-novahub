export function shouldRestoreSalesImportBatch(batch: {
  status?: string;
}): boolean {
  return String(batch.status || "").toUpperCase() !== "PREVIEW_FAILED";
}
