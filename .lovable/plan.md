# OVASYT Triple Extension Plan

This is a very large body of work spanning three independent feature suites. I want to confirm scope and sequencing **before** writing any code, because each suite involves schema, edge functions, and multi-portal UI changes. Nothing here removes existing logic — every change is additive.

---

## Suite 1 — Linked Employee Reimbursement System

Extend `purchase_requisitions` and the existing `reimbursements` table so a reimbursement is **always linked to a PR**, inherits its approval chain, and plugs into the new payment-batch lifecycle.

### Schema (one migration, additive)
- `purchase_requisitions`: add `requires_reimbursement boolean default false`.
- `reimbursements`: add
  - `pr_id uuid` (link to originating PR)
  - `payment_method text` (CASH / PERSONAL_CARD / EFT / OTHER)
  - `reimbursement_reference text`
  - `reimbursement_date date`
  - extend `status` enum with `AWAITING_PAYMENT` (keep PENDING/APPROVED/REJECTED/PAID)
  - `approved_by`, `approved_at`, `paid_at` already exist.
- New `reimbursement_audit_log` (id, reimbursement_id, action, old_status, new_status, performed_by, performed_at, notes) + RLS (Finance/Admin select scoped to org).
- RPC `submit_reimbursement_from_pr(_pr_id, _amount, _method, _reference, _date, _proof_url, _notes)` — creates reimbursement tied to PR after finance approval.
- RPC `approve_reimbursement` / `reject_reimbursement` (Finance only, writes audit log + notifications).
- Extend `confirm_batch_paid` so batches can include reimbursement allocations alongside invoice allocations. Add nullable `reimbursement_id` to `payment_allocations`.

### Frontend
- `PurchaseRequisitionForm.tsx`: add "This transaction requires employee reimbursement" toggle + collapsed fields (method, amount, reference, date, notes, proof upload to existing `pr-documents` bucket sub-path).
- `EmployeePortal`: new "My Reimbursements" tab listing rows joined to PRs.
- `FinancePortal`: new tabs **Pending Reimbursements**, **Approved Reimbursements**, **Awaiting Payment**, **Paid Reimbursements** (additive — Payments / Batches stays intact).
- `BatchPaymentModal`: allow selecting approved reimbursements alongside invoices; show "Reimbursement" badge.
- Finance Review modal: shows linked PR, proof image preview, employee details, timestamps, audit log.
- Validation: reimbursement amount ≤ PR total unless finance override flag.

### Notifications & Realtime
- Reuse existing `notifications` table + `useNotificationCounts`. Add channel subscription on `reimbursements` for finance and employee.

---

## Suite 2 — AI OCR Invoice / Receipt Analysis

Asynchronous assistant. **Never blocks uploads.** Manual workflows remain primary.

### Schema
- New `document_ai_analyses` (id, organization_id, document_url, document_type {INVOICE|RECEIPT|REIMBURSEMENT_PROOF|TAX_INVOICE}, status {PENDING|PROCESSING|READY|FAILED}, extracted_fields jsonb, confidence numeric, suggested_pr_id uuid nullable, suggested_invoice_id uuid nullable, vat_inclusive boolean, vat_amount numeric, total numeric, ai_notes text, created_at). RLS scoped to org (Finance/Admin/owner).
- Trigger: after insert into `invoices`, `reimbursements.proof_document_url`, or PR `document_url`, enqueue an analysis row in PENDING status.

### Edge function `analyze-document`
- Invoked via Supabase realtime trigger or DB hook (queued).
- Fetches signed URL → calls Lovable AI Gateway (`google/gemini-3-flash-preview` for text, image input) with structured tool-calling schema (supplier, invoice number, date, subtotal, VAT, total, line items).
- Computes match candidates: query org PRs/invoices by supplier name fuzzy + total amount within 1% → score High/Medium/Low.
- Writes back to `document_ai_analyses`. Never auto-links — only suggests.

### Frontend
- New `AIAnalysisCard` component: shows "Processing" / "Ready" / "Failed" with extracted fields, confidence badges, suggested matches, "Link to existing transaction" or "Create new" buttons.
- Embedded in `InvoicesTable`, supplier upload modal, reimbursement view, and PR detail modal.
- Duplicate-detection warning when invoice number or (supplier + amount) already exists.

### Safety
- File upload completes first; analysis is fire-and-forget.
- If AI fails or returns low confidence, show "AI could not confidently analyze — use manual entry" and leave manual workflow intact.

---

## Suite 3 — Mobile Camera Capture & Smart Scanning

Pure frontend extension; no backend changes.

### New `DocumentCapture` component
- Uses `<input type="file" accept="image/*" capture="environment">` for mobile camera. Detects mobile via `useIsMobile` hook (already exists).
- Live preview, retake, crop adjust (use `react-easy-crop`).
- Brightness/contrast boost + edge detection via OpenCV.js loaded on demand, or simpler `canvas` perspective correction.
- Multi-page capture: append pages to an in-memory array, merge to single PDF via `pdf-lib` before upload.
- Compression with `browser-image-compression` keeping ≥1500px longest edge for OCR quality.

### Integration points
- `PurchaseRequisitionForm` upload area, supplier `UploadInvoiceModal`, reimbursement proof upload.
- Desktop: existing drag-drop unchanged. Mobile: "Take Photo" / "Upload File" choice.
- After upload completes, trigger the same OCR pipeline from Suite 2 automatically.

### UI
- Camera overlay with edge-detection guides, scan animation, confidence dot, upload progress bar — themed with indigo glass tokens already in `index.css`.

---

## Sequencing & Risk

I recommend shipping these as three sequential migrations + PRs to keep diffs reviewable and reversible:

1. **Suite 1** first (schema + UI). Self-contained, unlocks reimbursement→batch flow.
2. **Suite 2** second (depends on file uploads existing — needs no Suite 1 schema, but benefits from reimbursement upload hook).
3. **Suite 3** last (UI-only, plugs into upload paths used by both Suite 1 and Suite 2).

Each suite is one DB migration + a small set of new files + minimal edits to existing forms/portals. No existing tables, RLS, RPCs, chat, batch, or supplier code will be removed or refactored.

---

## Confirmation Needed

This is roughly **8–12 hours of focused implementation** across the three suites and will require:

- 3 separate migrations
- 1 new edge function (`analyze-document`) with Lovable AI calls
- ~6 new components + 4 edited components
- 2 new libraries (`pdf-lib`, `browser-image-compression`, optionally `react-easy-crop`)

**Please confirm:**

1. Ship all three suites now, or sequentially in three separate approvals?
2. For OCR: confirm I should use **Lovable AI Gateway** (no extra API key, no Tesseract) — Gemini handles images directly. OK?
3. For mobile scanning: confirm the lightweight stack (browser camera + canvas/pdf-lib) is acceptable instead of pulling in a heavy native scanner SDK.

On approval I'll start with Suite 1's migration.