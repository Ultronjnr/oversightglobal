import { ReactNode } from "react";
import {LayoutDashboard, Building2, ReceiptText as Receipt, User, FileText, HandCoins, CreditCard, Wallet, CheckCheck, Layers, MessageSquare, Undo2, Percent, BarChart3, AlertCircle} from "lucide-react";
// Building2 used by adminNavItems below

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  /** Optional sidebar group heading (e.g. "Payments"). */
  group?: string;
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