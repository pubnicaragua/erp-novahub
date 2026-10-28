# Product Similarity Confirmation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the current broad similarity search but make its result an explicit choice to edit the found product or confirm creation of a new one.

**Architecture:** Preserve `inventoryService.checkSimilarProducts` and the backend confirmation contract. Update the shared alert's optional action labels, and wire the dedicated create page to the existing `EditProductModal` when the user chooses the found product.

**Tech Stack:** React, TypeScript, existing Dialog/Button primitives, Playwright dual full-stack specs.

**Spec:** `docs/superpowers/specs/2026-10-27-product-similarity-confirmation-design.md`

## Global Constraints

- Keep the current SKU/name similarity algorithm unchanged.
- Describe matches as possible similarities, not confirmed duplicates.
- A matching SKU cannot be created a second time; offer editing the existing record.
- Keep entered data until creation succeeds or the user chooses to edit the existing product.
- Keep user-facing copy in Spanish and reuse `EditProductModal`.

## Review Focus

- Similar name with a different SKU: show both edit and create choices; after a repeated similarity response, keep the draft and allow retry.
- Exact SKU match: do not offer duplicate creation; open the found product for editing and return to the list when closed.
- Existing-product lookup failure: keep the create form available and show an actionable error.
- Multi-row partial save: if an earlier row saves before a later row returns a similarity response, retry only the unfinished rows and remove saved rows from the pending list.
- Permissions: require `canPerform(INVENTORY_PRODUCTS, edit)` before opening the existing record editor.
- Variable products: make editing the parent product available independently from import-oriented variant linking.

---

### Task 1: Similar-product decision from the dedicated create page

**Files:**
- Modify: `e2e/specs/inventario-catalogo.spec.ts`
- Modify: `src/app/components/inventory/ProductSimilarityAlert.tsx`
- Modify: `src/app/components/inventory/AddProductsModal.tsx`
- Modify: `src/app/components/inventory/CrearProductoView.tsx`

**Interfaces:**
- `ProductSimilarityAlert` gains optional labels for the existing-product and create-new actions; callers that omit them retain their current wording.
- `CrearProductoView` loads the selected `SimilarProductMatch` with `inventoryService.getProduct` and passes that record to `EditProductModal`.

- [x] **Step 1: Add an E2E for confirming a similar-name product with a different SKU**
  Assert the alert calls it a possible match and offers “Editar producto existente” and “Crear producto nuevo”. Intercept the first create response as `PRODUCT_SIMILAR_MATCH`, confirm the second decision still has the entered code/name, retry, assert the retry sends `allowSimilarProductCreate: true`, and verify the new record in the isolated database.

- [ ] **Step 2: Run the focused E2E and confirm the expected failure**
  Run: `npx playwright test e2e/specs/inventario-catalogo.spec.ts --project=dual-desktop`
  Expected: the pre-change labels or decision flow fail while the isolated test database remains clean.

- [x] **Step 3: Add an E2E for opening the existing product in the editor**
  Assert an exact-SKU match offers edit, never create, selecting it opens the existing product in `EditProductModal` from the full-page create view, and closing the editor returns to the product list.

- [ ] **Step 4: Run the focused E2E and confirm the expected failure**
  Run: `npx playwright test e2e/specs/inventario-catalogo.spec.ts --project=dual-desktop`
  Expected: the existing product is not yet opened in the editor from the dedicated create view.

- [x] **Step 5: Add an E2E for existing-product lookup failure**
  Fail the first `GET /inventory/products/:id`, choose edit, and assert the error is visible while the create form and its entered values remain available; allow a later lookup to succeed.

- [ ] **Step 6: Run the focused E2E and confirm the expected failure**
  Run: `npx playwright test e2e/specs/inventario-catalogo.spec.ts --project=dual-desktop`
  Expected: the lookup failure currently closes the dedicated create page instead of returning to the draft.

- [x] **Step 7: Add regressions for batch retry, variable products, and create-only permissions**
  Assert prior successful rows are removed from retry, parent editing is available for variable products with and without exact SKU matches, and a create-only user cannot open the editor.

- [x] **Step 8: Implement alert labels and existing-product editing**
  Keep default shared-alert labels unchanged for imports. In `AddProductsModal`, pass confirmation copy and labels that identify the match as possible. In `CrearProductoView`, retain the page while loading the selected product, close the create form without discarding it during the handoff, and show `EditProductModal`; on lookup failure, restore the form and show an error. Gate the edit choice with the existing edit permission, allow parent editing for variable products in product-entry mode, and retry only rows not already saved.

- [x] **Step 9: Run frontend static checks**
  Run: `npx eslint src/app/components/inventory/AddProductsModal.tsx src/app/components/inventory/CrearProductoView.tsx src/app/components/inventory/ProductSimilarityAlert.tsx --quiet --no-cache`
  Expected: no lint errors.
  Run: `npx tsc --noEmit -p e2e/tsconfig.json`
  Expected: E2E specs compile without errors.
  Run: `npm run build`
  Expected: Vite production build succeeds.

  Run: `npx playwright test e2e/specs/inventario-catalogo.spec.ts --project=dual-desktop --list`
  Expected: all seven catalog scenarios are registered.

- [ ] **Step 10: Run focused E2E in the isolated database**
  Run: `npx playwright test e2e/specs/inventario-catalogo.spec.ts --project=dual-desktop`
  Expected: the similar-product confirmation, editing, data retention and persistence flows pass.

  **Not run in this checkout:** `DATABASE_URL_E2E`, `E2E_ALLOW_DATABASE_MUTATIONS`, `E2E_ISOLATED_DATABASE`, and `E2E_DUAL_FULLSTACK` are unset. The E2E README requires these guards before tests may mutate PostgreSQL. Playwright test discovery was checked with `--list`; this does not verify browser behavior or persistence.
