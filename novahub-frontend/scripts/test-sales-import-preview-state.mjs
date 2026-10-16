import assert from "node:assert/strict";
import { shouldRestoreSalesImportBatch } from "../src/app/components/ventas/importacion/sales-import-preview-state.ts";

assert.equal(
  shouldRestoreSalesImportBatch({ status: "PREVIEW_FAILED" }),
  false,
  "a failed parser batch must not restore as a usable preview",
);
assert.equal(
  shouldRestoreSalesImportBatch({ status: "PREVIEW" }),
  true,
  "a successful preview must remain restorable",
);
assert.equal(
  shouldRestoreSalesImportBatch({ status: "COMPLETED" }),
  true,
  "a confirmed batch must remain restorable",
);

console.log("Sales import preview state checks passed.");
