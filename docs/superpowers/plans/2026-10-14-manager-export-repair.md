# Manager report exports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que cada resumen y exportación de informes disponible en Manager refleje sus métricas, columnas, filtros, alcance y todos los registros reportables.

**Architecture:** Reutilizar las rutas Manager existentes y normalizar en frontend el contexto, los KPI etiquetados y las filas completas antes de crear archivos. Corregir en los servicios actuales los listados que ocultan filas detrás de topes de 5.000, conservando filtros, metadatos y autorización; usar un renderizador común para los informes y mantener intactas las plantillas transaccionales no afectadas.

**Tech Stack:** React, TypeScript, TanStack Query, ExcelJS, jsPDF/autoTable; NestJS, Prisma, Jest; Node `node:test` para pruebas de utilidades frontend.

**Spec:** `docs/superpowers/specs/2026-10-14-manager-exports-design.md`

## Global Constraints

- No agregar rutas HTTP, modelos Prisma ni migraciones.
- Mantener autorización de exportación, aislamiento por tenant y alcance de unidad/sucursal/bodega del Manager.
- Reenviar los filtros de la vista en cada página de un reporte.
- Construir los KPI desde `metrics` etiquetadas; una respuesta con `data: []` todavía puede contener un resumen válido.
- No generar tarjetas KPI vacías, filas ficticias ni resultados parciales presentados como completos.
- Incluir cada página reportable; los topes internos actuales de 5.000 deben dejar un `meta.total` verdadero y permitir leer las páginas restantes.
- Mantener separadas las hojas `Resumen` y `Detalle` en Excel cuando cada una aplique.
- El texto, la extensión y el MIME deben corresponder al archivo descargado; CSV en UTF-8 con BOM.
- Corregir los formatos disponibles sin agregar nuevos formatos o botones a una vista.
- No cambiar plantillas de facturas, cotizaciones, órdenes u otros documentos transaccionales salvo que se reproduzca el mismo defecto.

## Review Focus

- Overview con `data: []` y `metrics` pobladas: la exportación debe incluir etiquetas y valores KPI sin una tabla de detalle ficticia. Test: `managerReportExport.spec.mjs`, caso `keeps labelled metrics when detail rows are empty`.
- Resultado mayor de 5.000: `meta.total`, `totalPages` y páginas sucesivas deben reflejar la cuenta completa. Test: `enterprise-groups.manager-reports.spec.ts`, casos por cada familia backend modificada.
- Filtros de fecha, estado, búsqueda, moneda, unidad, sucursal y bodega: deben repetirse en todas las solicitudes del archivo. Test: `managerReportExport.spec.mjs`, caso `fetches every page with the same filters`.
- Alcance realmente vacío: mostrar mensaje legible sin KPI en blanco ni registros inventados. Test: `managerReportExport.spec.mjs`, caso `renders an explicit empty state`.
- CSV con acentos, delimitador, comillas y saltos de línea: abrir como texto tabular válido en Excel. Test: `managerReportExport.spec.mjs`, caso `serializes UTF-8 CSV fields safely`.

---

### Task 1: Shared Manager report model and file renderers

**Files:**
- Create: `Frontend/novahub-frontend/src/app/utils/managerReportExport.ts`
- Create: `Frontend/novahub-frontend/src/app/utils/managerReportExport.spec.mjs`
- Modify: `Frontend/novahub-frontend/src/app/utils/managerReportPdf.ts`
- Reference: `Frontend/novahub-frontend/src/app/hooks/useTenantQuery.ts` (`fetchAllReportPages`)
- Reference: `Frontend/novahub-frontend/src/app/utils/managerSalesExport.ts` (keep single-document exports on their specialized path)

**Interfaces:**
- Consumes: `ManagerReportOptions` with `title`, `fileBase`, `tenantName`, optional logo/color, `scopeSummary`, `filterSummary`, date range, currency, labelled `metrics`, ordered `columns`, and `rows`.
- Produces: `buildManagerReportModel(options)`, `exportManagerReportExcel(options)`, `exportManagerReportPdf(options)`, and `buildManagerCsv(rows, delimiter?)`. The model returns report metadata, labelled KPI pairs, columns, rows, and an explicit empty-state message where needed.

- [ ] **Step 1: Write the failing frontend utility tests** for populated metrics with no rows, an empty report, CSV quoting/BOM, and pagination that forwards the same filter object to each page.
- [ ] **Step 2: Run the focused test and confirm the expected failures.** Run from `Frontend/novahub-frontend`: `node --experimental-strip-types --test src/app/utils/managerReportExport.spec.mjs`.
- [ ] **Step 3: Implement the report model and exporters.** Use ExcelJS for `Resumen` and optional `Detalle`; use jsPDF/autoTable for a branded report header, scope and filter metadata, KPI labels/values, detail only when rows exist, and page numbers. Use the current PDF paper/color helpers and resolve logos through the existing report export utility.
- [ ] **Step 4: Re-run the focused test.** Expected: all model and CSV assertions pass; the PDF model has no unbound KPI slots.
- [ ] **Step 5: Commit the shared report utility and tests.**

### Task 2: Truthful pagination for capped Manager report contracts

**Files:**
- Modify: `Backend/src/enterprise-groups/enterprise-groups.service.ts`
- Create: `Backend/src/enterprise-groups/enterprise-groups.manager-reports.spec.ts`
- Reference: `Backend/src/enterprise-groups/enterprise-groups.controller.ts` (existing routes; no controller change expected)

**Interfaces:**
- Consumes: Existing Manager query parameters `view`, `report`, `export`, `page`, `pageSize`, search/status/date/currency filters.
- Produces: Existing response shape `{ view, data, meta: { total, page, pageSize, totalPages }, metrics }`, with true totals and page rows for affected list views.

- [ ] **Step 1: Add failing service tests** for report-mode page 2 and true totals above 5.000 rows in Inventory, consolidated Reports, HR, Finance, and Accounting. Include one request without export permission and one out-of-scope branch to pin existing rejection behavior.
- [ ] **Step 2: Run the focused Backend Jest file and confirm failures are caused by the 5.000-row cap or incorrect metadata.** Run from `Backend`: `npm test -- --runInBand src/enterprise-groups/enterprise-groups.manager-reports.spec.ts`.
- [ ] **Step 3: Correct only the existing affected query branches.** For reportable list rows, use the actual filtered count with `skip/take` or a chunked read where aggregation/grouping requires full-source rows; calculate metadata from the untruncated total. Keep overview metric queries and currency valuation complete or explicitly identify when the source contract says they are partial. Audit capped branches in `getInventoryModule`, `getReportsModule`, `getHrModule`, `getFinanceModule`, and `getAccountingModule`; retain already-correct database-paginated branches in Sales, Purchases, Operations, and Adjustments.
- [ ] **Step 4: Re-run the focused Jest file.** Expected: page 2 contains the correct rows, totals exceed 5.000 when fixtures do, and permission/scope failures remain enforced.
- [ ] **Step 5: Run the existing Manager operations scope test.** Run: `npm test -- --runInBand src/enterprise-groups/enterprise-groups.manager-operations.spec.ts`. Expected: existing tenant, branch, and export permission cases pass.
- [ ] **Step 6: Commit the Backend pagination fix and focused service tests.**

### Task 3: Apply shared reporting to Manager modules and per-view columns

**Files:**
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerInventoryModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerSalesModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerPurchasesModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerFinanceModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerAccountingModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerReportsModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerHRModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerOperationsModule.tsx`
- Modify: `Frontend/novahub-frontend/src/app/utils/managerReportPdf.ts` as required by Task 1

**Interfaces:**
- Consumes: `buildManagerReportModel`, `exportManagerReportExcel`, `exportManagerReportPdf`, and existing `fetchAllReportPages`; existing frontend services and response types.
- Produces: One explicit report definition per active exported view, preserving that view''s field labels/order and using its corresponding `metrics`.

- [ ] **Step 1: Add failing report-definition assertions** covering Overview metrics for Sales, Purchases, Finance, Accounting, Reports, HR, and Operations, plus representative detail rows from Inventory and each module family.
- [ ] **Step 2: Run the frontend focused test and confirm expected failures.** Run: `node --experimental-strip-types --test src/app/utils/managerReportExport.spec.mjs`.
- [ ] **Step 3: Integrate the common report model into each module handler.** Use `fetchAllReportPages` for detail exports and pass the current filters on every request. Define view-specific labels/columns rather than sending every module through a Sales or generic row shape. Map overview cards from the module''s existing KPI definitions. Keep quote-specific Excel/PDF and transactional detail document paths on their current dedicated templates.
- [ ] **Step 4: Re-run the focused tests.** Expected: overview metrics remain present with empty details; each tested module preserves its columns, scope, filters, currency, and empty state.
- [ ] **Step 5: Commit the consolidated Manager module exports.**

**View coverage:** Inventory `overview, branchInventory, corporateInventory, products, services, brands, warehouses, transfers, adjustments, audits, losses, movements, assets` (skip `corporateWarehouses`, which has no export action); Sales `overview, customers, quotes, orders, invoices, recurring, payments, creditnotes, credits, deliveries, cash` (skip `invoice-series`, which has no export action); Purchases `overview, suppliers, orders, receipts, invoices, recurring, payments, credits, expenses, recurringexpenses, requests, management`; Finance `overview, cash, receivables, payables, income, expenses, recurring, calendar, analysis, balance, losses`; Accounting `overview, chart, journal, ledger, trialBalance, profitLoss, balanceSheet, cashFlow, exchange, equity, assets, bankBook, reconciliation, periods, fiscal, invoiceAudit, budgets, expenseCategories, hrPaymentRequests`; Reports `overview, sales, purchases, financial, inventory, customers, providers, hr, subscriptions`; HR `overview, employees, departments, payroll, commissions, attendance, leaves, performance, kpi, training, benefits`; Operations: every `module/view` pair in `MANAGER_OPERATION_DEFINITIONS`.

### Task 4: Global Manager CSV and Inventory adjustments

**Files:**
- Modify: `Frontend/novahub-frontend/src/app/components/ManagerPage.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/manager/ManagerInventoryAdjustmentsView.tsx`
- Modify: `Frontend/novahub-frontend/src/app/utils/managerReportExport.ts`
- Modify: `Backend/src/enterprise-groups/enterprise-groups.service.ts` only if the existing adjustments response metadata is not accurate

**Interfaces:**
- Consumes: `buildManagerCsv`, `fetchAllReportPages`, current filtered adjustment query and `getAdjustments`.
- Produces: Global summary CSV accurately labelled `CSV`; activity CSV for only the visible page as labelled; PDF and XLSX adjustments using every filtered page.

- [ ] **Step 1: Add failing assertions** for CSV label/content and for an adjustments report containing more than one page.
- [ ] **Step 2: Run the focused tests and confirm expected failures.**
- [ ] **Step 3: Change the global summary button text to `Exportar CSV`, serialize all CSV content as UTF-8 with BOM and escaped cells, and leave audit activity at the current page while keeping its “Exportar página” semantics. Fetch all filtered adjustment pages before creating both Excel and PDF; replace `window.print()` of the current table with the shared report PDF.
- [ ] **Step 4: Re-run the focused tests.** Expected: CSV is valid for Spanish text and adjustments have no omitted page.
- [ ] **Step 5: Commit the global and adjustment export corrections.**

### Task 5: Layered verification and file review

**Files:**
- Review all files modified in Tasks 1–4.
- Create local fixture outputs only in a temporary/output location, not in the runtime source tree.

- [ ] **Step 1: Run frontend lint and build.** From `Frontend/novahub-frontend`: `npm run lint`, then `npm run build`. Expected: both pass; report any pre-existing warnings/errors separately.
- [ ] **Step 2: Run focused frontend report tests and the existing PDF template suite.** Run: `node --experimental-strip-types --test src/app/utils/managerReportExport.spec.mjs` and `npm run test:pdf-templates`. Expected: both pass.
- [ ] **Step 3: Run focused Backend tests and build.** Run from `Backend`: `npm test -- --runInBand src/enterprise-groups/enterprise-groups.manager-reports.spec.ts src/enterprise-groups/enterprise-groups.manager-operations.spec.ts`, then `npm run build`. Expected: focused tests and build pass; if Prisma generation is blocked by pre-existing schema work, record that separately and run `npx nest build` as a compile-only check.
- [ ] **Step 4: Review the final diff** with `git diff --check` in both repos and confirm no schema, migration, permission, controller, or transaction-template changes were introduced.
- [ ] **Step 5: Generate fixture PDF/XLSX outputs** for (a) KPI + empty details, (b) an empty report, (c) multiple-page details. Render the PDF and inspect its page layout; reopen the workbook and inspect sheet names, labels, rows, and currency formatting. Record these as artifact checks, separate from authenticated browser/API evidence.
- [ ] **Step 6: Review and commit the verified export corrections.**

**Execution note:** This is a single Manager reporting subsystem with shared report-model dependencies; execute in the current session in dependency order. Do not delegate module edits that share the new exporter or the monolithic Backend service.

