import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import {
  User,
  BarChart3,
  TrendingUp,
  FileText,
  DollarSign,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  LineChart,
} from "lucide-react";
import { getAnalyticsData, type AnalyticsData } from "@/services/analytics.service";
import { toast } from "sonner";

export default function Analytics() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // Build nav items based on role
  const getNavItems = () => {
    const baseHref = role === "EMPLOYEE" 
      ? "/employee/portal" 
      : role === "HOD" 
      ? "/hod/portal" 
      : role === "FINANCE"
      ? "/finance/portal"
      : "/admin/portal";

    return [
      { label: "My Portal", href: baseHref, icon: <User className="h-4 w-4" /> },
      { label: "Analytics", href: "/analytics", icon: <BarChart3 className="h-4 w-4" /> },
    ];
  };

  useEffect(() => {
    const fetchAnalytics = async () => {
      if (!user || !role) return;
      
      setIsLoading(true);
      const result = await getAnalyticsData(role, user.id, profile?.department);
      
      if (result.success && result.data) {
        setAnalytics(result.data);
      } else {
        toast.error(result.error || "Failed to load analytics");
      }
      setIsLoading(false);
    };

    fetchAnalytics();
  }, [user, role, profile?.department]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <DashboardLayout title="Analytics" navItems={getNavItems()}>
      <div className="space-y-6">
        {/* Subtitle */}
        <p className="text-muted-foreground -mt-4">
          Comprehensive insights and statistics for procurement management with advanced filtering and analysis
        </p>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-muted/50">
            <TabsTrigger 
              value="overview" 
              className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <BarChart3 className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="advanced" 
              className="gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-4 w-4" />
              Advanced Analytics
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard
                label="Total Quotes"
                value={analytics?.totalQuotes || 0}
                isLoading={isLoading}
                footer={
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-success" />
                    <span className="text-success">+12%</span>
                    <span>from last month</span>
                  </div>
                }
              />
              <StatCard
                label="Total Value"
                value={formatCurrency(analytics?.totalValue || 0)}
                valueColor="success"
                isLoading={isLoading}
                footer={
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-success" />
                    <span className="text-success">+8%</span>
                    <span>from last month</span>
                  </div>
                }
              />
              <StatCard
                label="Approval Rate"
                value={`${analytics?.approvalRate || 0}%`}
                valueColor="primary"
                isLoading={isLoading}
                footer={
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowDownRight className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">-2%</span>
                    <span>from last month</span>
                  </div>
                }
              />
              <StatCard
                label="Pending"
                value={analytics?.pending || 0}
                valueColor="warning"
                isLoading={isLoading}
                footer={
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ArrowUpRight className="h-3 w-3 text-warning" />
                    <span className="text-warning">+3</span>
                    <span>from yesterday</span>
                  </div>
                }
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Trends Card */}
              <SectionCard
                title="Monthly Quote Trends"
                icon={<LineChart className="h-5 w-5" />}
              >
                <div className="h-64 flex items-center justify-center">
                  {analytics?.monthlyTrends && analytics.monthlyTrends.length > 0 ? (
                    <div className="w-full space-y-3">
                      {analytics.monthlyTrends.map((trend, index) => (
                        <div key={trend.month} className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground w-10">{trend.month}</span>
                          <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                            <div
                              className="h-full bg-primary/80 rounded-full flex items-center justify-end pr-2"
                              style={{
                                width: `${Math.max(
                                  10,
                                  (trend.count /
                                    Math.max(...analytics.monthlyTrends.map((t) => t.count || 1))) *
                                    100
                                )}%`,
                              }}
                            >
                              <span className="text-xs text-white font-medium">{trend.count}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <LineChart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No trend data available</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Status Distribution Card */}
              <SectionCard
                title="Quote Status Distribution"
                icon={<PieChart className="h-5 w-5" />}
              >
                <div className="h-64 flex items-center justify-center">
                  {analytics?.statusDistribution && analytics.statusDistribution.length > 0 ? (
                    <div className="w-full space-y-3">
                      {analytics.statusDistribution.map((item) => {
                        const colors: Record<string, string> = {
                          "Pending HOD": "bg-warning",
                          "HOD Approved": "bg-blue-500",
                          "Pending Finance": "bg-orange-400",
                          "Approved": "bg-success",
                          "Declined": "bg-destructive",
                          "Split": "bg-purple-500",
                        };
                        return (
                          <div key={item.status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`h-3 w-3 rounded-full ${colors[item.status] || "bg-muted"}`} />
                              <span className="text-sm">{item.status}</span>
                            </div>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <PieChart className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No status data available</p>
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Quick Insights */}
            <SectionCard
              title="Quick Insights"
              icon={<TrendingUp className="h-5 w-5" />}
            >
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle className="h-5 w-5 text-success" />
                  <div>
                    <p className="text-xs text-muted-foreground">Approved Today</p>
                    <p className="text-lg font-bold text-success">{analytics?.approvedToday || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-warning/10 border border-warning/20">
                  <Clock className="h-5 w-5 text-warning" />
                  <div>
                    <p className="text-xs text-muted-foreground">Awaiting Action</p>
                    <p className="text-lg font-bold text-warning">{analytics?.awaitingAction || 0}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-primary/10 border border-primary/20">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Quote Value</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(analytics?.avgQuoteValue || 0)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </TabsContent>

          {/* Advanced Analytics Tab */}
          <TabsContent value="advanced" className="mt-6">
            <SectionCard
              title="Advanced Analytics"
              icon={<TrendingUp className="h-5 w-5" />}
            >
              <div className="h-64 flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Coming Soon</p>
                  <p className="text-sm mt-1">Advanced analytics features are under development</p>
                </div>
              </div>
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
