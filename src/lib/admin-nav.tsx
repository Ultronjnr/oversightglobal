import { ReactNode } from "react";
import {LayoutDashboard, Building2, ReceiptText as Receipt, User, FileText, HandCoins, CreditCard, Wallet, CheckCheck, Layers, MessageSquare} from "lucide-react";
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
        label: "Payment Batches",
        href: "/finance/portal?tab=batches",
        icon: <Layers className="h-4 w-4" />,
        group: "Payments",
      },
    );
  }

  return items;
}