import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/ui/stat-card";
import { SectionCard } from "@/components/ui/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  User,
  BarChart3,
  TrendingUp,
  DollarSign,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
  LineChart as LineChartIcon,
  Download,
  FileText,
  FileSpreadsheet,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { getAnalyticsData, type AnalyticsData } from "@/services/analytics.service";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  "Pending HOD": "#f59e0b",
  "HOD Approved": "#3b82f6",
  "Pending Finance": "#fb923c",
  "Approved": "#22c55e",
  "Declined": "#ef4444",
  "Split": "#a855f7",
  "HOD Declined": "#ef4444",
};

export default function Analytics() {
  const { user, role, profile } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

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

  const exportToCSV = () => {
    if (!analytics) {
      toast.error("No data to export");
      return;
    }

    const reportDate = format(new Date(), "yyyy-MM-dd");
    const roleLabel = role === "EMPLOYEE" ? "Personal" : role === "HOD" ? "Department" : "Organization";
    
    let csvContent = `Procurement Analytics Report - ${roleLabel}\n`;
    csvContent += `Generated: ${format(new Date(), "PPpp")}\n`;
    csvContent += `User: ${profile?.name} ${profile?.surname || ""}\n\n`;
    
    csvContent += "SUMMARY STATISTICS\n";
    csvContent += `Total Quotes,${analytics.totalQuotes}\n`;
    csvContent += `Total Value,${analytics.totalValue}\n`;
    csvContent += `Approval Rate,${analytics.approvalRate}%\n`;
    csvContent += `Pending,${analytics.pending}\n`;
    csvContent += `Approved Today,${analytics.approvedToday}\n`;
    csvContent += `Awaiting Action,${analytics.awaitingAction}\n`;
    csvContent += `Average Quote Value,${analytics.avgQuoteValue}\n\n`;
    
    csvContent += "MONTHLY TRENDS\n";
    csvContent += "Month,Count,Value\n";
    analytics.monthlyTrends.forEach(trend => {
      csvContent += `${trend.month},${trend.count},${trend.value}\n`;
    });
    csvContent += "\n";
    
    csvContent += "STATUS DISTRIBUTION\n";
    csvContent += "Status,Count\n";
    analytics.statusDistribution.forEach(item => {
      csvContent += `${item.status},${item.count}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics-report-${reportDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Report exported successfully");
  };

  const exportToJSON = () => {
    if (!analytics) {
      toast.error("No data to export");
      return;
    }

    const reportDate = format(new Date(), "yyyy-MM-dd");
    const roleLabel = role === "EMPLOYEE" ? "Personal" : role === "HOD" ? "Department" : "Organization";
    
    const reportData = {
      metadata: {
        reportType: "Procurement Analytics",
        scope: roleLabel,
        generatedAt: new Date().toISOString(),
        generatedBy: `${profile?.name} ${profile?.surname || ""}`.trim(),
      },
      summary: {
        totalQuotes: analytics.totalQuotes,
        totalValue: analytics.totalValue,
        approvalRate: analytics.approvalRate,
        pending: analytics.pending,
        approvedToday: analytics.approvedToday,
        awaitingAction: analytics.awaitingAction,
        avgQuoteValue: analytics.avgQuoteValue,
      },
      monthlyTrends: analytics.monthlyTrends,
      statusDistribution: analytics.statusDistribution,
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `analytics-report-${reportDate}.json`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("Report exported successfully");
  };

  const printReport = () => {
    window.print();
    toast.success("Print dialog opened");
  };

  // Prepare chart data
  const pieChartData = analytics?.statusDistribution.map(item => ({
    name: item.status,
    value: item.count,
    color: STATUS_COLORS[item.status] || "#94a3b8",
  })) || [];

  const areaChartData = analytics?.monthlyTrends.map(trend => ({
    month: trend.month,
    count: trend.count,
    value: trend.value / 1000, // Convert to thousands for better display
  })) || [];

  return (
    <DashboardLayout title="Analytics" navItems={getNavItems()}>
      <div className="space-y-6 print:space-y-4">
        {/* Header with Export */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 -mt-4">
          <p className="text-muted-foreground">
            Comprehensive insights and statistics for procurement management with advanced filtering and analysis
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 print:hidden">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToJSON} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={printReport} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Print Report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full grid grid-cols-2 h-12 bg-muted/50 print:hidden">
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
              {/* Monthly Trends Chart */}
              <SectionCard
                title="Monthly Quote Trends"
                icon={<LineChartIcon className="h-5 w-5" />}
              >
                <div className="h-72">
                  {areaChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={areaChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis 
                          dataKey="month" 
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          yAxisId="left"
                          tick={{ fontSize: 12 }}
                          className="text-muted-foreground"
                        />
                        <YAxis 
                          yAxisId="right" 
                          orientation="right"
                          tick={{ fontSize: 12 }}
                          tickFormatter={(value) => `R${value}k`}
                          className="text-muted-foreground"
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                          formatter={(value: number, name: string) => {
                            if (name === 'value') return [`R${(value * 1000).toLocaleString()}`, 'Value'];
                            return [value, 'Quotes'];
                          }}
                        />
                        <Legend />
                        <Area
                          yAxisId="left"
                          type="monotone"
                          dataKey="count"
                          name="Quotes"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorCount)"
                        />
                        <Area
                          yAxisId="right"
                          type="monotone"
                          dataKey="value"
                          name="Value (R thousands)"
                          stroke="hsl(var(--success))"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <LineChartIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No trend data available</p>
                      </div>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Status Distribution Pie Chart */}
              <SectionCard
                title="Quote Status Distribution"
                icon={<PieChartIcon className="h-5 w-5" />}
              >
                <div className="h-72">
                  {pieChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          labelLine={false}
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--background))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                          }}
                        />
                        <Legend 
                          verticalAlign="bottom" 
                          height={36}
                          formatter={(value) => <span className="text-sm">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                      <div className="text-center">
                        <PieChartIcon className="h-12 w-12 mx-auto mb-2 opacity-30" />
                        <p>No status data available</p>
                      </div>
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
          <TabsContent value="advanced" className="mt-6 space-y-6">
            {/* Value by Month Bar Chart */}
            <SectionCard
              title="Monthly Value Breakdown"
              icon={<BarChart3 className="h-5 w-5" />}
            >
              <div className="h-72">
                {areaChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={areaChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        className="text-muted-foreground"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `R${value}k`}
                        className="text-muted-foreground"
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: number) => [`R${(value * 1000).toLocaleString()}`, 'Value']}
                      />
                      <Bar 
                        dataKey="value" 
                        name="Value"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>No value data available</p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SectionCard title="Performance Summary">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Total Requisitions</span>
                    <span className="font-semibold">{analytics?.totalQuotes || 0}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Total Value</span>
                    <span className="font-semibold text-success">{formatCurrency(analytics?.totalValue || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Approval Rate</span>
                    <span className="font-semibold text-primary">{analytics?.approvalRate || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Avg Value</span>
                    <span className="font-semibold">{formatCurrency(analytics?.avgQuoteValue || 0)}</span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Status Breakdown">
                <div className="space-y-3">
                  {analytics?.statusDistribution.map(item => (
                    <div key={item.status} className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: STATUS_COLORS[item.status] || "#94a3b8" }}
                        />
                        <span className="text-sm">{item.status}</span>
                      </div>
                      <Badge variant="secondary">{item.count}</Badge>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-sm">No data available</p>
                  )}
                </div>
              </SectionCard>

              <SectionCard title="Today's Activity">
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Approved</span>
                    <Badge className="bg-success/10 text-success hover:bg-success/20">
                      {analytics?.approvedToday || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Awaiting Action</span>
                    <Badge className="bg-warning/10 text-warning hover:bg-warning/20">
                      {analytics?.awaitingAction || 0}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Pending Review</span>
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/20">
                      {analytics?.pending || 0}
                    </Badge>
                  </div>
                </div>
              </SectionCard>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
