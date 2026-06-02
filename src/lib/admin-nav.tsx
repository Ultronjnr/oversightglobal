import { ReactNode } from "react";
import { LayoutDashboard, Building2, Receipt } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
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
];