# Ovasyt Internal Command Center

## Goal
Replace the current compact internal overview with the selected premium executive command-center layout, without changing customer-facing workflows.

## What will change
- Add a collapsible left drawer with the Ovasyt logo and sections for Overview, Organisations, Customer Intelligence, Analytics, Advertisements, and Platform Activity.
- Reorganise existing platform totals into compact, readable executive cards.
- Show organisation records with names, NGO/NPO/business classification, contact details, signup dates, activity, and usage.
- Add customer intelligence from onboarding answers: pain points, causes, funding, team size, and acquisition source, including custom “Other” answers.
- Add recent organisation and user signup views.
- Add the supplied Lovable traffic analytics: visitors, page views, engagement, sources, pages, devices, and countries.
- Keep advertisement management inside the same internal workspace.
- Remove “Unspecified” from the organisation-type chart and present incomplete profile data separately and clearly.

## Security and data handling
- Reuse the existing internal-admin authentication and role check.
- Add internal-admin-only read functions for organisation contacts, users, and onboarding intelligence.
- Expose only necessary customer information; no passwords, payment tokens, or authentication secrets.
- Keep all organisation/customer dashboards and workflows unchanged.

## Validation
- Confirm the internal dashboard opens for an authorised internal admin.
- Check drawer collapse/restore, every section, live customer data, and advertisement management.
- Check desktop and mobile layouts for fitting text, cards, controls, and tables.
- Confirm no authentication or browser-console errors on the internal dashboard.
