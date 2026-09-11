import { ReactNode } from "react";
import {LayoutDashboard, Building2, ReceiptText as Receipt, User, FileText, HandCoins, CreditCard, Wallet, CheckCheck, Layers, MessageSquare, Undo2, Percent, BarChart3, AlertCircle, Users, Mail, Truck, Settings, ClipboardList, ShieldCheck} from "lucide-react";
// Building2 used by adminNavItems below

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  /** Optional sidebar group heading (e.g. "Payments"). */
  group?: string;
  /** Hide the entry when the signed-in user lacks this permission. */
  permission?: string;
  /** Live actionable item count rendered as a compact navigation bubble. */
  badgeCount?: number;
}

/**
 * Shared top-level navigation for all Admin pages.
 * Keeps the header consistent across the Admin Dashboard,
 * Cost Center / Department History, and Expense History.
 */
export const adminNavItems: NavItem[] = [
  { label: "Dashboard", href: "/admin/portal", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Cost Center / Department History", href: "/cost-center-history", icon: <Building2 className="h-4 w-4" /> },
  { label: "Expense History", href: "/expenses", icon: <Receipt className="h-4 w-4" /> },
  { label: "Donations / 18A", href: "/donations", icon: <HandCoins className="h-4 w-4" /> },
  { label: "Messages", href: "/inbox", icon: <MessageSquare className="h-4 w-4" /> },
  { label: "Billing", href: "/billing", icon: <CreditCard className="h-4 w-4" /> },

  // Administration workspaces (rendered as standalone pages)
  { label: "Company Profile", href: "/admin/portal?tab=company", icon: <Building2 className="h-4 w-4" />, group: "Administration" , permission: "users.view" },
  { label: "Users & Roles", href: "/admin/portal?tab=users", icon: <Users className="h-4 w-4" />, group: "Administration" , permission: "users.view" },
  { label: "Cost Centers / Depts", href: "/admin/portal?tab=departments", icon: <Building2 className="h-4 w-4" />, group: "Administration" , permission: "users.view" },
  { label: "Invitations", href: "/admin/portal?tab=invitations", icon: <Mail className="h-4 w-4" />, group: "Administration" , permission: "users.invite" },
  { label: "Users & Permissions", href: "/admin/portal?tab=permissions", icon: <ShieldCheck className="h-4 w-4" />, group: "Administration" , permission: "users.manage_permissions" },
  { label: "Settings", href: "/admin/portal?tab=settings", icon: <Settings className="h-4 w-4" />, group: "Administration" , permission: "users.edit" },

  // Operations workspaces
  { label: "Transactions", href: "/expenses", icon: <ClipboardList className="h-4 w-4" />, group: "Operations", permission: "transactions.view" },

  { label: "Purchase Requisitions", href: "/admin/portal?tab=prs", icon: <FileText className="h-4 w-4" />, group: "Operations" , permission: "requisitions.view" },
  { label: "Analytics", href: "/admin/portal?tab=analytics", icon: <BarChart3 className="h-4 w-4" />, group: "Operations" , permission: "reports.view" },

  // Finance workspaces — the Super User can run these directly when the
  // organisation has no Finance / HOD staff (or is a one-person organisation).
  { label: "Approvals", href: "/admin/portal?tab=approvals", icon: <Wallet className="h-4 w-4" />, group: "Finance" , permission: "requisitions.approve" },
  { label: "Suppliers", href: "/admin/portal?tab=suppliers", icon: <Truck className="h-4 w-4" />, group: "Finance" , permission: "suppliers.view" },
  { label: "Quotes", href: "/admin/portal?tab=quotes", icon: <FileText className="h-4 w-4" />, group: "Finance" , permission: "suppliers.view" },
  { label: "Invoices", href: "/admin/portal?tab=invoices", icon: <Receipt className="h-4 w-4" />, group: "Finance" , permission: "invoices.view" },
  { label: "Reimbursements", href: "/admin/portal?tab=reimbursements", icon: <Undo2 className="h-4 w-4" />, group: "Finance" , permission: "finance.view" },
  { label: "Input VAT", href: "/admin/portal?tab=input_vat", icon: <Percent className="h-4 w-4" />, group: "Finance" , permission: "finance.view" },
  { label: "VAT Dashboard", href: "/admin/portal?tab=vat_dashboard", icon: <Percent className="h-4 w-4" />, group: "Finance" , permission: "finance.view" },
  { label: "Reports", href: "/admin/portal?tab=reports", icon: <BarChart3 className="h-4 w-4" />, group: "Finance" , permission: "reports.view" },

  // Payment queues
  { label: "Approved – Not Paid", href: "/admin/portal?tab=payments", icon: <Wallet className="h-4 w-4" />, group: "Payments" , permission: "finance.process" },
  { label: "Partially Paid", href: "/admin/portal?tab=partially_paid", icon: <Wallet className="h-4 w-4" />, group: "Payments" , permission: "finance.view" },
  { label: "Fully Paid", href: "/admin/portal?tab=fully_paid", icon: <CheckCheck className="h-4 w-4" />, group: "Payments" , permission: "finance.view" },
  { label: "Overdue (30+)", href: "/admin/portal?tab=overdue", icon: <AlertCircle className="h-4 w-4" />, group: "Payments" , permission: "finance.view" },
  { label: "Payment Batches", href: "/admin/portal?tab=batches", icon: <Layers className="h-4 w-4" />, group: "Payments" , permission: "finance.process" },
];



/**
 * Role-aware top navigation used across the Employee / HOD / Finance portals
 * and their shared history pages. Finance gets the extra
 * "Cost Center / Department History" tab.
 */
export function getPortalNavItems(role?: string | null): NavItem[] {
  if (role === "ADMIN") return adminNavItems;

  const base =
    role === "FINANCE"
      ? "/finance/portal"
      : role === "HOD"
      ? "/hod/portal"
      : "/employee/portal";

  const items: NavItem[] = [
    { label: "My Portal", href: base, icon: <User className="h-4 w-4" /> },
    ...(role === "FINANCE"
      ? [
          {
            label: "Cost Center / Department History",
            href: "/cost-center-history",
            icon: <Building2 className="h-4 w-4" />,
          },
        ]
      : []),
    { label: "Purchase Requisition History", href: "/pr-history", icon: <FileText className="h-4 w-4" /> },
    { label: "Expense History", href: "/expenses", icon: <Receipt className="h-4 w-4" /> },
    { label: "Messages", href: "/inbox", icon: <MessageSquare className="h-4 w-4" /> },
  ];

  if (role === "HOD" || role === "EMPLOYEE" || !role) {
    items.push(
      {
        label: "My Requisitions",
        href: `${base}?tab=requisitions`,
        icon: <ClipboardList className="h-4 w-4" />,
        group: "My Work",
      },
      {
        label: "My Reimbursements",
        href: `${base}?tab=reimbursements`,
        icon: <Undo2 className="h-4 w-4" />,
        group: "My Work",
      },
    );
  }


  if (role === "FINANCE") {
    items.push({ label: "Donations / 18A", href: "/donations", icon: <HandCoins className="h-4 w-4" /> });
    items.push(
      { label: "Approvals", href: "/finance/portal?tab=approvals", icon: <Wallet className="h-4 w-4" />, group: "Finance" },
      { label: "Suppliers", href: "/finance/portal?tab=suppliers", icon: <Building2 className="h-4 w-4" />, group: "Finance" },
      { label: "Quotes", href: "/finance/portal?tab=quotes", icon: <FileText className="h-4 w-4" />, group: "Finance" },
      { label: "Invoices", href: "/finance/portal?tab=invoices", icon: <Receipt className="h-4 w-4" />, group: "Finance" },
      { label: "Reimbursements", href: "/finance/portal?tab=reimbursements", icon: <Undo2 className="h-4 w-4" />, group: "Finance" },
      { label: "Input VAT", href: "/finance/portal?tab=input_vat", icon: <Percent className="h-4 w-4" />, group: "Finance" },
      { label: "VAT Dashboard", href: "/finance/portal?tab=vat_dashboard", icon: <Percent className="h-4 w-4" />, group: "Finance" },
      { label: "Reports", href: "/finance/portal?tab=reports", icon: <BarChart3 className="h-4 w-4" />, group: "Finance" },
    );
    items.push(
      {
        label: "Approved – Not Paid",
        href: "/finance/portal?tab=payments",
        icon: <Wallet className="h-4 w-4" />,
        group: "Payments",
      },
      {
        label: "Partially Paid",
        href: "/finance/portal?tab=partially_paid",
        icon: <Wallet className="h-4 w-4" />,
        group: "Payments",
      },
      {
        label: "Fully Paid",
        href: "/finance/portal?tab=fully_paid",
        icon: <CheckCheck className="h-4 w-4" />,
        group: "Payments",
      },
      {
        label: "Overdue (30+)",
        href: "/finance/portal?tab=overdue",
        icon: <AlertCircle className="h-4 w-4" />,
        group: "Payments",
      },
      {
        label: "Payment Batches",
        href: "/finance/portal?tab=batches",
        icon: <Layers className="h-4 w-4" />,
        group: "Payments",
      },
    );
  }


  return items;
}

/**
 * Super User navigation filtered to the functions the signed-in user is
 * actually allowed to use.
 */
export function getAdminNavItems(can: (key: string) => boolean): NavItem[] {
  return adminNavItems.filter((item) => !item.permission || can(item.permission));
}
