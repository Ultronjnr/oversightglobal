import { supabase } from "@/integrations/supabase/client";
import { handleServiceError } from "@/lib/error-handler";

export interface AnalyticsData {
  totalQuotes: number;
  totalValue: number;
  approvalRate: number;
  pending: number;
  approvedToday: number;
  awaitingAction: number;
  avgQuoteValue: number;
  monthlyTrends: { month: string; count: number; value: number }[];
  statusDistribution: { status: string; count: number }[];
}

export async function getAnalyticsData(
  role: string,
  userId: string,
  department?: string | null
): Promise<{ success: boolean; data?: AnalyticsData; error?: string }> {
  try {
    // Get the user's organization first
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();

    if (!profile?.organization_id) {
      return { success: false, error: "User organization not found" };
    }

    // Build the query based on role
    let query = supabase.from("purchase_requisitions").select("*");

    if (role === "EMPLOYEE") {
      // Employee only sees their own PRs
      query = query.eq("requested_by", userId);
    } else if (role === "HOD") {
      // HOD sees PRs from their department
      query = query
        .eq("organization_id", profile.organization_id)
        .neq("status", "PENDING_HOD_APPROVAL"); // HOD sees approved/processed PRs for analytics
      if (department) {
        query = query.eq("requested_by_department", department);
      }
    } else if (role === "FINANCE") {
      // Finance sees all org PRs (except pending HOD)
      query = query
        .eq("organization_id", profile.organization_id)
        .neq("status", "PENDING_HOD_APPROVAL");
    }

    const { data: prs, error: prError } = await query;

    if (prError) throw prError;

    const allPRs = prs || [];

    // Calculate stats
    const totalQuotes = allPRs.length;
    const totalValue = allPRs.reduce((sum, pr) => sum + Number(pr.total_amount || 0), 0);
    
    const approved = allPRs.filter(
      (pr) => pr.status === "FINANCE_APPROVED" || pr.status === "HOD_APPROVED"
    ).length;
    const approvalRate = totalQuotes > 0 ? Math.round((approved / totalQuotes) * 100) : 0;
    
    const pending = allPRs.filter(
      (pr) => pr.status === "PENDING_HOD_APPROVAL" || pr.status === "PENDING_FINANCE_APPROVAL"
    ).length;

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const approvedToday = allPRs.filter((pr) => {
      const updatedAt = new Date(pr.updated_at);
      return (
        updatedAt >= today &&
        (pr.status === "FINANCE_APPROVED" || pr.status === "HOD_APPROVED")
      );
    }).length;

    const awaitingAction = allPRs.filter(
      (pr) => pr.status === "PENDING_HOD_APPROVAL" || pr.status === "PENDING_FINANCE_APPROVAL"
    ).length;

    const avgQuoteValue = totalQuotes > 0 ? Math.round(totalValue / totalQuotes) : 0;

    // Monthly trends (last 6 months)
    const monthlyTrends: { month: string; count: number; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthName = date.toLocaleString("default", { month: "short" });
      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthPRs = allPRs.filter((pr) => {
        const createdAt = new Date(pr.created_at);
        return createdAt >= monthStart && createdAt <= monthEnd;
      });

      monthlyTrends.push({
        month: monthName,
        count: monthPRs.length,
        value: monthPRs.reduce((sum, pr) => sum + Number(pr.total_amount || 0), 0),
      });
    }

    // Status distribution
    const statusCounts: Record<string, number> = {};
    allPRs.forEach((pr) => {
      statusCounts[pr.status] = (statusCounts[pr.status] || 0) + 1;
    });

    const statusDistribution = Object.entries(statusCounts).map(([status, count]) => ({
      status: formatStatus(status),
      count,
    }));

    return {
      success: true,
      data: {
        totalQuotes,
        totalValue,
        approvalRate,
        pending,
        approvedToday,
        awaitingAction,
        avgQuoteValue,
        monthlyTrends,
        statusDistribution,
      },
    };
  } catch (error) {
    return { success: false, error: handleServiceError("analytics", error) };
  }
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING_HOD_APPROVAL: "Pending HOD",
    HOD_APPROVED: "HOD Approved",
    HOD_DECLINED: "HOD Declined",
    PENDING_FINANCE_APPROVAL: "Pending Finance",
    FINANCE_APPROVED: "Approved",
    FINANCE_DECLINED: "Declined",
    SPLIT: "Split",
  };
  return map[status] || status;
}
