import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PRNotificationProvider } from "@/components/PRNotificationProvider";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import LandingPage from "./pages/LandingPage";
import Pricing from "./pages/Pricing";
import SignupCompany from "./pages/SignupCompany";
import ResetPassword from "./pages/ResetPassword";
import OAuthConsent from "./pages/OAuthConsent";

import Invite from "./pages/Invite";
import JoinSupplier from "./pages/JoinSupplier";
import SupplierRegister from "./pages/SupplierRegister";
import Unsubscribe from "./pages/Unsubscribe";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import PRHistory from "./pages/PRHistory";
import ExpenseHistory from "./pages/ExpenseHistory";
import CostCenterHistory from "./pages/CostCenterHistory";

// Portals
import EmployeePortal from "./pages/portals/EmployeePortal";
import HODPortal from "./pages/portals/HODPortal";
import FinancePortal from "./pages/portals/FinancePortal";
import AdminPortal from "./pages/portals/AdminPortal";
import SupplierPortal from "./pages/portals/SupplierPortal";
import FreemiumPortal from "./pages/portals/FreemiumPortal";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
          <PRNotificationProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Index />} />
            <Route path="/signup/company" element={<SignupCompany />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/invite" element={<Invite />} />
            <Route path="/join/supplier" element={<JoinSupplier />} />
            <Route path="/supplier/register" element={<SupplierRegister />} />
            <Route path="/portal/supplier/register" element={<SupplierRegister />} />
            <Route path="/unsubscribe" element={<Unsubscribe />} />

            {/* Analytics - accessible by EMPLOYEE, HOD, FINANCE */}
            <Route
              path="/analytics"
              element={
                <ProtectedRoute allowedRoles={["EMPLOYEE", "HOD", "FINANCE", "ADMIN"]}>
                  <Analytics />
                </ProtectedRoute>
              }
            />

            {/* PR History - accessible by EMPLOYEE, HOD, FINANCE, ADMIN */}
            <Route
              path="/pr-history"
              element={
                <ProtectedRoute allowedRoles={["EMPLOYEE", "HOD", "FINANCE", "ADMIN"]}>
                  <PRHistory />
                </ProtectedRoute>
              }
            />

            {/* Expense History */}
            <Route
              path="/expenses"
              element={
                <ProtectedRoute allowedRoles={["EMPLOYEE", "HOD", "FINANCE", "ADMIN"]}>
                  <ExpenseHistory />
                </ProtectedRoute>
              }
            />

            {/* Cost Center / Department History - ADMIN & FINANCE */}
            <Route
              path="/cost-center-history"
              element={
                <ProtectedRoute allowedRoles={["ADMIN", "FINANCE"]}>
                  <CostCenterHistory />
                </ProtectedRoute>
              }
            />

            {/* Employee Portal */}
            <Route
              path="/employee/portal"
              element={
                <ProtectedRoute allowedRoles={["EMPLOYEE"]}>
                  <EmployeePortal />
                </ProtectedRoute>
              }
            />

            {/* HOD Portal */}
            <Route
              path="/hod/portal"
              element={
                <ProtectedRoute allowedRoles={["HOD"]}>
                  <HODPortal />
                </ProtectedRoute>
              }
            />

            {/* Finance Portal */}
            <Route
              path="/finance/portal"
              element={
                <ProtectedRoute allowedRoles={["FINANCE"]}>
                  <FinancePortal />
                </ProtectedRoute>
              }
            />

            {/* Admin Portal */}
            <Route
              path="/admin/portal"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <AdminPortal />
                </ProtectedRoute>
              }
            />

            {/* Supplier Portal */}
            <Route
              path="/supplier/portal"
              element={
                <ProtectedRoute allowedRoles={["SUPPLIER"]}>
                  <SupplierPortal />
                </ProtectedRoute>
              }
            />

            {/* Freemium Portal — simplified workspace for FREEMIUM tier */}
            <Route
              path="/freemium/portal"
              element={
                <ProtectedRoute allowFreemium>
                  <FreemiumPortal />
                </ProtectedRoute>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </PRNotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
