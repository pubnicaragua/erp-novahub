# PDF Appearance Scope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set PDF appearance for every editable PDF in the active branch or override selected appearance properties for one PDF, including a self-hosted whole-document font family.

**Architecture:** Persist a validated sparse appearance profile in `SystemSetting` under a PDF-specific key and expose it through the existing PDF-design controller. Resolve branch profile, explicit document overrides, and current defaults through one frontend resolver; route the resolved values through the shared renderer and direct PDF settings consumers. Keep document structure, content, paper dimensions, and fixed ticket/label renderers outside shared appearance.

**Tech Stack:** NestJS, Prisma `SystemSetting`, class-validator, React/TypeScript, existing API wrapper, Fontsource local font assets, html2canvas, jsPDF, Jest, Node's built-in assertions.

**Spec:** `docs/superpowers/specs/2026-10-19-pdf-appearance-scope-design.md`

## Global Constraints

- Global appearance applies to every PDF of the **active branch** only.
- Resolve each property in this order: document override, branch global value, existing NovaHub default.
- A missing document override means inherit; saving one property must not freeze other properties locally.
- Preserve existing custom document designs; values of uncertain origin remain local until explicitly reset.
- Keep paper size, orientation, content structure, data, and document-specific columns local to each PDF.
- Apply the chosen font to the whole editable PDF while preserving semantic weight, italics, relative size, and alignment.
- Use packaged local font files; do not fetch fonts at render time or add font-file uploads.
- Keep fixed ticket and product-label output dimensions and renderers unchanged.
- Store the appearance profile separately from `pdf/company-profile`; derive tenant/branch scope from the authenticated request.
- Do not change the existing purchase import work or unrelated dirty files in either repository.

## Review Focus

- Concurrent or repeated profile writes and pre-existing duplicate `SystemSetting` rows: update the branch-scoped setting consistently and never leak another branch's value. Pin with service tests in Task 1.
- Legacy designs with non-default appearance values: preserve non-default values as local overrides and keep unknown provenance local. Pin default/non-default inference in Task 2.
- A partial local override: changing the local font must still inherit global header spacing, composition, and palette. Pin per-property merging and reset in Task 2.
- Imported HTML frames and node-level fonts: the selected whole-document font must win in the final preview and PDF while preserving weight/italic/relative size. Pin resolver/render assertions in Task 3 and preview review in Task 4.
- Fixed ticket and label targets: appearance changes must not change physical dimensions or their specialized renderer. Pin target classification in Task 3.

---

### Task 1: Branch-scoped appearance profile API

**Files:**
- Create: `Backend/src/pdf-document-designs/dto/pdf-appearance-profile.dto.ts`
- Modify: `Backend/src/pdf-document-designs/pdf-document-designs.controller.ts`
- Modify: `Backend/src/pdf-document-designs/pdf-document-designs.service.ts`
- Test: `Backend/src/pdf-document-designs/pdf-document-designs.service.spec.ts`
- Test: `Backend/src/pdf-document-designs/pdf-document-designs.controller.spec.ts` (create if no controller spec exists)

**Interfaces:**
- Produces sparse `PdfAppearanceProfile` with optional shared properties: `headerComposition`, `headerContentSpacing`, `fontFamily`, `fontSize`, `presetId`, `tableStyle`, and partial `palette`.
- Produces `getAppearanceProfile(clientTenantId: string): Promise<PdfAppearanceProfile>`; return `{}` when no explicit global settings exist.
- Produces `updateAppearanceProfile(clientTenantId: string, patch: PdfAppearanceProfilePatchDto): Promise<PdfAppearanceProfile>`.
- HTTP contract: `GET /pdf-document-designs/appearance-profile` requires `CONFIG_PDF:read`; `PATCH /pdf-document-designs/appearance-profile` requires `CONFIG_PDF:edit`. Neither accepts a tenant or branch ID.

- [ ] **Step 1: Write service tests for empty profile, branch isolation, partial updates, null resets, duplicate rows, and local override validation.** Assert that missing profile returns `{}`; reads and updates filter only the authenticated `clientTenantId`; partial palette updates preserve other palette keys; `null` removes only the requested global property; updates modify every matching legacy duplicate rather than creating another row; and a document cannot save an unsupported appearance font.
- [ ] **Step 2: Run the focused backend test and confirm the new profile tests fail for the missing methods.** Run: `npm test -- --runInBand src/pdf-document-designs/pdf-document-designs.service.spec.ts` from `Backend`. Expected: the new profile cases fail because the service methods/constants are not implemented; existing unrelated assertions remain unchanged.
- [ ] **Step 3: Add `PdfAppearanceProfilePatchDto` with nested palette validation and closed enums.** Accept only the three header compositions, three spacing values, supported family names, font size 7–16, the seven table presets, and validated six-digit hex colors for known palette keys. Update the backend font allow-list with the catalog from Task 2. Unknown fields are rejected by the global validation pipe.
- [ ] **Step 4: Implement profile persistence and local override validation in `PdfDocumentDesignsService`.** Use `group=pdf`, `key=appearance-profile`; derive scope with `requireClientTenantScope`; merge a patch with the latest valid sparse profile; remove only keys whose patch value is `null`; update all matching scoped rows or create when none exist; ignore values stored for any other `clientTenantId`. Validate `settings.appearanceOverrides` during design create/update using the same bounds and allow-lists. Keep company-profile logic and key untouched.
- [ ] **Step 5: Add guarded GET/PATCH controller routes and controller tests.** Pass only `req.user.clientTenantId` to the service and verify the existing permission decorators are attached to the two routes.
- [ ] **Step 6: Run focused backend tests and build.** Run the service/controller specs and `npm run build` from `Backend`. Expected: focused specs pass and NestJS build succeeds.

### Task 2: Frontend profile types, font registry, and inheritance resolver

**Files:**
- Create: `Frontend/novahub-frontend/src/app/services/pdf-appearance.ts`
- Modify: `Frontend/novahub-frontend/src/app/services/pdf-document-design.service.ts`
- Modify: `Frontend/novahub-frontend/src/app/services/pdf-document-style.ts`
- Modify: `Frontend/novahub-frontend/scripts/test-pdf-appearance.mjs`
- Modify: `Frontend/novahub-frontend/package.json`
- Modify: `Frontend/novahub-frontend/package-lock.json`
- Modify: `Frontend/novahub-frontend/src/styles/fonts.css`

**Interfaces:**
- `PdfAppearanceProfile` and `PdfAppearanceOverrides` mirror the backend shape; both are sparse and property-level.
- `pdfDocumentDesignService.getAppearanceProfile(): Promise<PdfAppearanceProfile>` calls `GET /pdf-document-designs/appearance-profile`.
- `pdfDocumentDesignService.updateAppearanceProfile(patch: Partial<PdfAppearanceProfile>): Promise<PdfAppearanceProfile>` calls `PATCH /pdf-document-designs/appearance-profile`.
- `resolvePdfAppearance(fallback, profile, overrides): PdfAppearanceProfile` merges each scalar and palette key in local → branch → fallback order.
- `inferLegacyPdfAppearanceOverrides(targetKey, settings, definition): PdfAppearanceOverrides` preserves known non-default legacy values and marks unclassifiable non-empty values local.
- `updatePdfAppearanceDraft(scope, profile, overrides, key, value)` changes either the branch draft or only the selected document override; `resetPdfAppearanceOverride(overrides, key)` removes one local override.

- [ ] **Step 1: Add Node assertion tests for precedence, partial palette merging, reset/inherit, and legacy inference.** Include tests `resolves_document_override_before_branch_profile`, `inherits_unset_properties_individually`, `resetting_override_restores_branch_value`, and `preserves_non_default_legacy_style_as_local_override`.
- [ ] **Step 2: Run `node --experimental-strip-types scripts/test-pdf-appearance.mjs` and confirm the new imports/exports fail before implementation.** Expected: failure because `pdf-appearance.ts` exports are not yet present.
- [ ] **Step 3: Add typed profile/override normalization and the pure resolver.** Keep `paperSize`, `orientation`, structural settings, and content out of the profile. Validate frontend profile values against the same allow-list as the backend.
- [ ] **Step 4: Add legacy inference based on existing system defaults.** Values equal to the target's current default inherit; values differing from the default stay local; malformed or unknown non-empty values are preserved as local and normalized only for rendering.
- [ ] **Step 5: Add the local font catalog and samples.** Reuse Montserrat and Playfair Display already installed; add self-hosted families Inter, Roboto, Open Sans, Lato, Nunito Sans, Merriweather, Lora, IBM Plex Mono, and JetBrains Mono. Group options as sans serif, serif, and monospace, with local Latin font assets and regular/bold weights.
- [ ] **Step 6: Replace coarse font-family collapsing with the exact selected family.** Update `normalizePdfFontFamily` and the font registry so each listed family has a real local `@font-face`; retain safe generic fallback stacks for missing assets.
- [ ] **Step 7: Run the resolver script and inspect the dependency/import diff.** Expected: all resolver assertions pass, font imports point to installed local assets, and no remote font URL is introduced.

### Task 3: Shared resolution in PDF generation and rendering

**Files:**
- Modify: `Frontend/novahub-frontend/src/app/utils/pdfGenerator.ts`
- Modify: `Frontend/novahub-frontend/src/app/utils/pdf-template-renderer.ts`
- Modify: `Frontend/novahub-frontend/src/app/utils/purchaseExports.ts` only if the call-site audit shows it bypasses the resolved design/settings APIs
- Modify: `Frontend/novahub-frontend/scripts/test-pdf-templates.mjs` or `scripts/test-pdf-appearance.mjs`

**Interfaces:**
- `getPdfDesign(targetKey)` returns the design enriched with effective appearance and explicit local override metadata without changing paper, content, or structural nodes.
- `getPdfDesignSettings(targetKey, timeoutMs?)` returns effective appearance fields while retaining the existing timeout fallback behavior.
- `renderPdfTemplateToPdf` accepts resolved settings and uses the resolved whole-document font for nodes, tables, HTML frame regions, and footer; existing target-specific layout behavior remains intact.

- [ ] **Step 1: Add failing tests for editable-vs-fixed targets, whole-document font precedence over node/imported-frame fonts, and preserving relative styles.** Assert that node weight/italic remain and that ticket/label settings do not receive page-level overrides.
- [ ] **Step 2: Run the focused PDF script and confirm those assertions fail against current font collapsing/renderer behavior.** Expected: the font-precedence assertion fails while existing PDF template contracts still pass.
- [ ] **Step 3: Add branch-profile loading and cache it by authenticated branch scope.** `getPdfDesign` must load the profile once per cache lifetime, resolve document overrides, and include it in the returned effective design; clear design and profile caches after profile or design saves and on scope change.
- [ ] **Step 4: Resolve legacy settings without overwriting stored documents.** Prefer explicit `settings.appearanceOverrides`; otherwise use Task 2 inference. Preserve old `settings` and `layoutZones.definition.metadata.pdfStyleConfig` values in storage.
- [ ] **Step 5: Apply resolved values at the shared render boundary.** Ensure the `pdfStyleConfig` embedded in an imported definition cannot override the selected whole-document font/palette/table values; node-level font-family declarations cannot override the selected family, but weight, italics, relative font size, and alignment remain.
- [ ] **Step 6: Wait for local fonts before capture.** Await `document.fonts.load` for the selected family and required weights, then `document.fonts.ready`, before html2canvas captures each PDF page. Preserve existing error/fallback behavior if a font fails to load.
- [ ] **Step 7: Audit all `getPdfDesign` and `getPdfDesignSettings` consumers.** Confirm transaction PDFs, purchase PDFs, reports, and direct jsPDF exports receive global font/appearance. Add a narrow adapter at any consumer that bypasses both APIs; do not modify fixed ticket/label renderers.
- [ ] **Step 8: Run PDF assertion scripts and review one sales document, one purchase document, one multi-page report, and one direct report export in preview/final output.** Expected: preview/export appearance matches, custom non-default legacy styles remain, and specialized physical dimensions are unchanged.

### Task 4: Global/local controls in the PDF design editor

**Files:**
- Create: `Frontend/novahub-frontend/src/app/components/configuracion/PdfAppearanceSettingsPanel.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/configuracion/PdfDocumentCustomizer.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/configuracion/PdfTemplateCanvasEditor.tsx`
- Modify: `Frontend/novahub-frontend/src/app/components/configuracion/PdfStyleTemplateEditor.tsx` only if it is wired into the active design editor during implementation; otherwise leave the unused component unchanged

**Interfaces:**
- `PdfAppearanceSettingsPanel` receives `scope: 'branch' | 'document'`, effective profile, branch profile, local overrides, `canEdit`, and callbacks for property change/save/reset.
- `updatePdfAppearanceDraft(scope, profile, overrides, key, value)` and `resetPdfAppearanceOverride(overrides, key)` are pure functions exported from `src/app/services/pdf-appearance.ts` and tested in this task.
- Branch scope saves the shared profile once and updates every editable PDF that inherits it.
- Document scope writes only `settings.appearanceOverrides` for the selected design; resetting removes only visual overrides and restores inheritance.

- [ ] **Step 1: Add tests for `updatePdfAppearanceDraft` and `resetPdfAppearanceOverride`.** Assert branch edits change only the branch profile draft; document edits change only the chosen appearance key; reset removes only that key and leaves paper/orientation/content untouched.
- [ ] **Step 2: Run `node --experimental-strip-types scripts/test-pdf-appearance.mjs` and confirm the new state-transition tests fail before the helpers exist.** Expected: missing exports for the two state helpers.
- [ ] **Step 3: Implement the two pure draft/reset helpers in `pdf-appearance.ts` and rerun the assertion script.** Expected: branch/local update and property-level reset tests pass.
- [ ] **Step 4: Add an accessible scope selector labelled “Todos los PDF de esta sucursal” and “Solo este PDF”.** Default to per-document scope when no explicit branch profile exists and branch scope when one does; after an explicit choice, show which scope will be saved.
- [ ] **Step 5: Add global/local controls for header composition, post-header spacing, whole-document font family/base size, table preset, and palette.** Reuse existing option sketches, tokens, inputs, and accessible focus states; show whether each property inherits or has a local override.
- [ ] **Step 6: Integrate the panel with `PdfDocumentCustomizer` and the existing save flows.** Branch changes call the appearance-profile API; local changes populate sparse `settings.appearanceOverrides` and are saved with the active PDF design. Add a per-document “Restablecer a apariencia global” action that does not delete content or paper settings.
- [ ] **Step 7: Feed the effective appearance to the canvas editor and live preview.** Keep component font controls visible as formatting metadata, but preview output uses the whole-document family selected by the resolver. Refresh preview and caches after global/local save.
- [ ] **Step 8: Exercise the real editor at 375, 768, 1024, and 1440 px.** Confirm scope labels, inherited/local states, keyboard operation, focus, dark mode, no viewport overflow, branch save propagation, local-only save, reset, preview, and exported PDF.

### Task 5: Cross-repository completion checks

**Files:**
- Review diff only; no unrelated files may be staged or modified.

- [ ] **Step 1: Run focused backend profile/controller tests and `npm run build` from `Backend`.** Record failures separately from pre-existing failures.
- [ ] **Step 2: Run frontend PDF scripts and `npm run build` from `Frontend/novahub-frontend`.** Record failures separately from pre-existing failures.
- [ ] **Step 3: Verify API scope with the authenticated demo account.** Read and update the profile on the active branch; confirm a second branch retains its own profile and a user without `CONFIG_PDF:edit` cannot patch it. Do not use or change database records outside this scoped profile.
- [ ] **Step 4: Review Git status and diffs in both repositories.** Confirm purchases WIP files remain untouched and unstaged; confirm only the PDF feature files and the plan/spec documentation are part of this task.

## Coverage Self-Review

- Spec sections 1–3: goal, branch-only scope, precedence, partial overrides, reset, legacy preservation → Tasks 1, 2, and 4.
- Spec sections 4–5: shared properties, per-document structural settings, broad local fonts, whole-document font, loaded-font readiness → Tasks 2–4.
- Spec sections 6 and 9: separate setting key, authenticated branch scope, validation, permission enforcement, scoped cache → Tasks 1 and 3.
- Spec sections 7–8: shared resolver, preview/export parity, inherited indicators, apply scope → Tasks 3 and 4.
- Spec section 10: service/resolver tests, representative documents, specialized formats, responsive editor, builds → Tasks 1–5.
- Spec section 11: no font upload, no cross-branch sync, no content/page-size changes, no fixed ticket/label redesign → Global Constraints and Tasks 3–4.

## Execution Notes

- Backend `main` and frontend `master` are independent Git repositories. Preserve the existing unrelated purchases work in both checkouts.
- Current shared appearance data can fit in `SystemSetting`; no schema migration is planned.
- Do not push or deploy as part of implementation unless the user explicitly asks after reviewing the completed changes.
