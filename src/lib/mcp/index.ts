import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoami from "./tools/whoami";
import listPurchaseRequisitions from "./tools/list-purchase-requisitions";
import getPurchaseRequisition from "./tools/get-purchase-requisition";
import listSuppliers from "./tools/list-suppliers";
import listNotifications from "./tools/list-notifications";

// The OAuth issuer must be the direct Supabase host, built from the project ref
// (SUPABASE_URL is the Lovable proxy host and would fail issuer matching).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "ovasyt-mcp",
  title: "Ovasyt Procurement MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Ovasyt procurement platform. Use `whoami` to identify the signed-in user, `list_purchase_requisitions` and `get_purchase_requisition` to inspect requisitions, `list_suppliers` to browse suppliers, and `list_notifications` for the user's alerts. All data is scoped to the signed-in user's access.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    whoami,
    listPurchaseRequisitions,
    getPurchaseRequisition,
    listSuppliers,
    listNotifications,
  ],
});