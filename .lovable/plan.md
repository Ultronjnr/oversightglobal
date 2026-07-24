## Scope

Five focused changes across the Finance portal. All are UI/service-layer; no schema changes required (Phase 1 already added project_id/donor_id + allocation RPC).

### 1. Move "Cost Center" into Finance Overview top tab row
- Finance portal already renders `CostCenterHistoryContent` inside a tab, but it sits at the far right of a wrapping second row. Reorder the `TabsList` so **Cost Center** appears in the primary (top) row, matching the Admin portal's tab layout in the reference screenshot.
- Also rename the tab label from "Cost Center" to "Cost Center / Department" for consistency with the standalone route.

### 2. Fix Batches tab
- Investigate current failures in `BatchesTab.tsx` / `BatchPaymentModal.tsx`: verify list load, refresh triggers, and the batch-create → batch-submit path against `payment_batches` RLS.
- Ensure the tab respects `refreshTrigger` and rebinds after batch creation. Surface real error messages via toast.

### 3. Project / Donor selectors on Categorize Purchase Requisition
- Add two searchable Combobox fields to `CategorySelectionModal.tsx`:
  - **Project (optional)** — "— No project —" default; list `donation_projects` for org; inline "Create new project" action (name + optional budget, uses existing donation service).
  - **Donor (optional)** — "— No donor —" default; list `organization_donors`; inline "Create new donor" (name + email).
- Persist the selection through `financeApprovePR` → set `project_id` / `donor_id` on the PR + downstream transaction, and (when project selected) call `allocate_project_funds` RPC to reserve budget at approval time. Block approval with a clear error if the budget check fails.

### 4. Scan AI Invoice — allow the scan to run
- Debug the modal end-to-end (upload → `analyze-document` invocation → PR creation). Recent OCR model change to `google/gemini-3.1-flash-lite` may be returning empty extractions on some files; confirm and fall back to `google/gemini-3.6-flash` when the lite model returns an empty payload.
- Fix upload / storage errors by ensuring the modal writes to the correct bucket (`invoice-documents`) with the user-scoped path and passes both `bucket` + `storage_path` to the edge function.
- Preserve the existing Project/Donor pickers and budget guard.

### 5. Fast OCR + inline review mode
- **Speed**: keep the lite model as primary, cap `max_output_tokens`, drop unnecessary reasoning fields, and stream the response back to the modal so fields render as soon as they arrive.
- **Review UI**: after OCR completes, show a two-pane review step inside `ScanInvoiceModal`:
  - Left: the uploaded document preview (image thumb or PDF iframe) with translucent highlight boxes over recognised regions when the model returns bounding hints (fallback: label chips above the preview when no coordinates).
  - Right: editable form for `supplier_name`, `supplier_vat_number`, `document_number`, `document_date`, `subtotal`, `vat_amount`, `total_amount`, line items, banking details. Each field shows a confidence pill (High / Medium / Low) coloured from `confidence`.
  - "Confirm & Save" commits via existing `createTransactionFromInvoice`; "Rescan" re-runs `analyze-document` with `force: true`.

## Technical Notes

- Types: no migration needed for review mode — reuse existing `OcrExtracted`. Bounding-box overlay is best-effort based on whatever the model returns; when absent, fall back to per-field confidence chips only.
- Reordering the Finance tabs will change tab counts widths; verify wrapping on 1119px viewport (current preview width).
- `financeApprovePR` currently accepts `(prId, comments, categoryId, supplierId)`. Extend it to accept `projectId?` and `donorId?` and call `allocate_project_funds` server-side when a project is chosen.

## Out of Scope

- No changes to landing page, donations panel, or other portals.
- No schema migrations (columns/RPCs from Phase 1 are reused).
- Not touching the OCR review overlay for reimbursements or PR documents (only the scan-invoice flow).
