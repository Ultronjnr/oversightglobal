# Pre-launch fix and test pass

Goal: work through every item on your list, then run a full live test (solo and multi-user organisations) so the app is ready for real customers, transactions and payments.

## 1. Sign-up and onboarding
- Remove Legal Name from sign-up.
- Fix onboarding skipping ahead after the first Company Details step. All steps must be completed before the dashboard opens.
- Fill in company name and registration number on Section 18A / Company Details automatically, taken from onboarding.
- Merge "NPO number" and "NPO registration number" into one field.
- Add input formats and checks for every number field: company registration (YYYY/NNNNNN/NN), NPO (NNN-NNN NPO), PBO, VAT (10 digits), phone, bank account and branch code.

## 2. Invitations and login
- When an invite expires, allow sending a new one instead of showing "invitation already sent".
- Add a show/hide password toggle on the invite and login pages.
- If the invited person already has an account, send them to log in (with Forgot password) instead of asking them to create a new password.
- After login, show a role picker when the user has more than one role or organisation. The chosen role decides which portal opens, and they can switch later from the header.
- Role separation: Employee, HOD and Finance see only their own functions. Super User powers apply only to Super Users and to one-person organisations.

## 3. Money and dashboards
- Show all amounts in one format everywhere: ZAR 1 234 567.89.
- Fix "first expense" still showing after an expense has been created.
- Fix payment batches from start to finish: create, pay, then mark paid.
- When a batch is paid, project funds move from Allocated to Spent. The dashboard and the Funding page will show the same figures.

## 4. Free tier and locking
- Grey out VAT Dashboard when the organisation is not VAT registered.
- Grey out Billing for now, which reverses the earlier unlock.
- Grey out every function that is not part of the free tier, with a clear "Upgrade" label.

## 5. Speed
- Make invoice scanning faster: shrink images before upload, use a faster AI model, and show progress while it scans.

## 6. Dashboard slider
- Make the slider bigger and more eye-catching.
- Two kinds of slides:
  - **Slides built from your data**: spend, funds, audit readiness.
  - **Slides you control from the Ovasyt internal dashboard**: adverts and notices. For each one you choose who sees it: all organisations, certain types (NPO, NGO, business), or specific organisations.

## 7. Full test
- Test end to end in the browser as a solo organisation and as a multi-user organisation: sign-up, onboarding, invites, role picker, expense, scan, quotes, requisition, approvals, invoice, batch, paid, project Spent figure, reports, and advert targeting.
- Report back what works and anything still blocked. Note: live plan payments through Yoco need Billing turned back on when you are ready to charge.

## Technical notes
- Role picker: read every row in user_roles, store the chosen role for the session, and have ProtectedRoute use the chosen role.
- Funds: a trigger on batch payment turns RESERVED allocations into SPENT and syncs the pool totals.
- VAT lock: comes from organisation vat_status. Tier locks: extend feature-scope.
