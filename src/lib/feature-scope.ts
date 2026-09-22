/**
 * Scope freeze (Phase 1).
 *
 * While the one-person core finance lifecycle is being finished, everything
 * that needs extra users, advanced permissions or paid billing is temporarily
 * switched off. These areas stay in the product (nothing is deleted) but are
 * shown as greyed-out / "coming soon" so no one can start a workflow that
 * cannot complete yet.
 */
export const SCOPE_FREEZE_ACTIVE = true;

/** Navigation hrefs that are temporarily unavailable. */
export const LOCKED_FEATURE_HREFS: Record<string, string> = {
  "/admin/portal?tab=users": "Additional users",
  "/admin/portal?tab=invitations": "User invitations",
  "/admin/portal?tab=permissions": "Advanced permissions",
  "/billing": "Billing & subscriptions",
};

/** Super User tab keys that are temporarily unavailable. */
export const LOCKED_ADMIN_TABS = ["users", "invitations", "permissions"] as const;

export function isFeatureLocked(href: string): boolean {
  return SCOPE_FREEZE_ACTIVE && href in LOCKED_FEATURE_HREFS;
}

export function isAdminTabLocked(tab: string | null | undefined): boolean {
  return (
    SCOPE_FREEZE_ACTIVE &&
    !!tab &&
    (LOCKED_ADMIN_TABS as readonly string[]).includes(tab)
  );
}

export const SCOPE_FREEZE_MESSAGE =
  "This area is being finished and is switched off for now. Your current plan covers one Super User running the full expense, invoice, requisition and payment workflow.";
