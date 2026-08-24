# Layered Build from the Transcripts

Both attached transcripts are treated as the specification. We build one layer per message, you test it in Lovable, then we move to the next. Nothing from a later layer gets touched early.

## What the audit found (verified, not assumed)

- Project and Donor columns exist on requisitions, transactions and invoices, and they are properly linked to the donation projects and donor registry.
- The requisition form and the Scan-AI review screen both already show Project/Donor pickers.
- **But the link does not survive the workflow**: of 92 requisitions only 22 carry a project/donor, and of 92 transactions only **7** do. So almost nothing reaches the payment queue or the donation budget with its funding source attached.
- Fund reservation against a project budget is "best effort" — if it fails, the error is swallowed silently and nobody is told.
- The transcripts add a rule we never implemented: **only Finance may set Project and Donor**, because tagging a project spends that project's 18A budget. Employees and HODs currently see the same fields.
- The transcripts also say the expense category field must be hidden on the employee requisition form.

---

# Layer 1 (this layer): Purchase Requisition -> Project & Donor, done properly

Goal: every requisition and every transaction that comes out of one carries a correct funding source, only Finance can set it, and the money visibly moves against the project budget.

### 1. Who can set Project and Donor
- Finance and Admin: full Project/Donor pickers on the requisition form, on the Scan-AI review screen, and on the Finance approval screen.
- Employee and HOD: fields hidden entirely. They submit item description, quantity and a motivation only.
- The pickers read from the real donation projects and donor registry — free text is never accepted, so the old foreign-key error cannot come back.
- Where a requisition already has a funding source set by Finance, employees/HODs see it read-only as a label, never as an editable control.

### 2. Finance sets or corrects it at approval time
- The Finance approval screen (Incoming Requisitions -> Approve, and Approve & Assign Supplier) gets a required-by-choice Project/Donor step: Finance either picks a project/donor or explicitly chooses "No project funding".
- When a project is chosen, the screen shows live budget context before approval: project budget, already reserved, already spent, remaining, and what this requisition would leave behind. If the requisition exceeds the remaining budget, approval is blocked with a clear message rather than failing silently.

### 3. Make the link survive the whole chain
Project and Donor are carried, without exception, from the requisition into:
- the transaction created on approval,
- the supplier invoice attached later,
- the Approved – Not Paid queue,
- the payment batch allocation,
- the fund allocation row against the project budget.

Any path that creates a transaction (direct approval, quote-then-invoice, Scan AI) uses the same single piece of logic so the three routes cannot drift apart again.

### 4. Reserve and spend against the project budget for real
- On approval: reserve the amount against the project (RESERVED).
- On payment confirmation: convert the reservation to spent (SPENT).
- If the reservation fails, the approval fails with the real reason shown on screen — no more silent warnings.
- The Donation Management project view shows Budget / Reserved / Spent / Remaining consistent with these movements.

### 5. Backfill and visibility
- Existing transactions inherit the Project/Donor from their parent requisition where one exists, so history stops looking empty.
- Project and Donor are shown as columns/badges in the Approved – Not Paid queue and in the expanded transaction row, and are filterable by project.

### How you test Layer 1
1. As an Employee, create a requisition — no Project, Donor or Expense Category fields appear.
2. As Finance, open that requisition, pick a project and donor, see the budget preview, approve.
3. Confirm the resulting transaction in Approved – Not Paid shows the same project and donor.
4. Open Donation Management and confirm the project's Reserved figure went up by that amount.
5. Create a batch, confirm payment, and confirm Reserved becomes Spent.
6. Repeat via Scan AI and via the quote-to-invoice route and confirm identical behaviour.

---

# Roadmap of the remaining layers (not built yet)

- **Layer 2 – Payments**: per-transaction payment reference (mandatory) and per-transaction proof of payment (optional) inside a batch; supplier banking details shown on screen; "Confirm Paid" renamed to "Process Batch" and stepping through each transaction one by one; payment date defaults to today; remove the non-functional Pay via Netcash button.
- **Layer 3 – Payment status views**: Approved – Not Paid grouped by date; separate Partially Paid and Fully Paid tabs; a partially-paid item leaves Approved – Not Paid and shows the outstanding balance; sidebar Payments group.
- **Layer 4 – Supplier sourcing inside the requisition**: submit a requisition with no supplier; HOD/Finance add multiple supplier quotes to one requisition (existing platform suppliers or manually added), each quote scannable; Finance picks the winning quote and only that one hits the financials.
- **Layer 5 – Chat inbox**: a dedicated chat icon listing all transaction conversations WhatsApp-style, newest message on top, unread badge clearing on open.
- **Layer 6 – VAT and OCR rules**: remove manual VAT input/output selection; AI derives VAT status (standard, zero-rated, exempt, not registered) only when an invoice is attached; flag incorrectly charged VAT; retro-attaching an invoice triggers the VAT assessment.
- **Layer 7 – Dashboard workspace**: reduce dashboard cards to two layers of information, full-screen workspace per module, Expense History by category.
- **Layer 8 – Reporting**: supplier statement of account, outstanding payables report.
- **Layer 9 – Admin settings**: configurable permissions (allow HOD to set Project/Donor, VAT-mandatory rule, who sources suppliers).
- **Layer 10 – Mobile navigation** rework, and Netcash / further Yoco work when you're ready.

## Technical notes

- New migration adds a role guard so Project/Donor can only be written by Finance/Admin, plus a trigger that copies project_id/donor_id from requisition to transaction and invoice so the link cannot be dropped by any code path.
- `allocate_project_funds` is called inside the approval transaction and its error is raised, not swallowed; a matching release/settle path runs on payment confirmation.
- The three transaction origins (DPR, SQI, SCN) converge on one shared service function for funding-source propagation.
- A one-off backfill statement fills project_id/donor_id on existing transactions from their parent requisition.
