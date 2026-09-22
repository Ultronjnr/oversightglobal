# Oversight Admin Dashboard + Controlled Ads + New Dashboard Slider

Three pieces: an internal Ovasyt-only dashboard (with a login for you), an advertisement system you fully control, and the new premium slider design on every portal.

## 1. Oversight Admin (internal, platform-wide)

A separate area at `/oversight`, invisible to normal users, reachable only by accounts flagged as platform staff.

- New platform-staff flag stored separately from organisation roles, so no NPO user can ever grant it to themselves.
- Read-only cross-organisation views (organisations cannot see each other; only platform staff can):
  - Organisations: count, name, type/industry, onboarding status, signup date, plan/trial state
  - Active users: totals, per organisation, last-seen activity
  - Transaction volume: count and value over time, per organisation
  - Expense categories and spending patterns (top categories, top suppliers, monthly trend)
  - Donors and projects: totals, funds allocated, receipts issued
  - Usage: scans, requisitions, quotes, payment batches, logins
  - Advertisement performance (views, clicks, click-through)
- Layout mirrors the existing workspace shell: overview cards, trend charts, a sortable organisations table with a drill-down per organisation.

### Your login
I will create one platform-staff account and give you the email and a temporary password in chat. Change the password on first sign-in. Tell me which email address to use; otherwise I will use `oversight@ovasyt.tech`.

## 2. Advertisement system (Phase 12)

Under Oversight Admin only:

```text
Create advert -> audience (all / org type / plan / specific organisations)
             -> schedule (start + end date) -> publish -> appears in dashboard slider
```

- Adverts have title, message, image, call-to-action label + link, tone, priority, status (draft / scheduled / live / ended).
- Targeting by organisation type, plan tier, role, or a hand-picked list of organisations.
- Only published adverts inside their date window are served; nothing else can inject slides. Organisations never create adverts.
- Views and clicks are recorded so the performance numbers above are real.

## 3. New premium slider on all portals

Rebuild the top panel used by Super User, Finance, HOD and Employee dashboards to match the supplied design:

- Full-width panel: left hero block (greeting, headline, image background, small feature callout), right grid of six live metric tiles (Total Spend MTD with sparkline, Outstanding Payables, Undocumented Records, Procurement Progress, Audit Readiness ring, Recent Activity bars) and a right-hand notice/advert column.
- Auto-rotating pages with arrows and dots, pause on hover, responsive down to mobile (hero stacks above a 2-column tile grid).
- All figures stay live from the organisation's own data; role-aware as today. The notice column shows the current targeted advert, or an Ovasyt message when none is live.

## Technical notes

- Tables: `platform_admins`, `advertisements`, `advertisement_targets`, `advertisement_events`; all with GRANTs and restrictive RLS (platform staff write; organisations read only the adverts targeted at them).
- Cross-tenant reads go through SECURITY DEFINER functions gated on `is_platform_admin(auth.uid())` — no broad table grants.
- New route `/oversight` behind a platform-staff guard; existing role routing untouched.
- `SmartPanel.tsx` rebuilt in place so all four portals pick up the new design without per-portal changes.
- Existing workflows (requisitions, quotes, invoices, batches) are not modified.
