import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

// Pages
import Index from "./pages/Index";
import Login from "./pages/Login";
import SignupCompany from "./pages/SignupCompany";
import SignupSupplier from "./pages/SignupSupplier";
import Invite from "./pages/Invite";
import NotFound from "./pages/NotFound";
import Analytics from "./pages/Analytics";
import PRHistory from "./pages/PRHistory";

// Portals
import EmployeePortal from "./pages/portals/EmployeePortal";
import HODPortal from "./pages/portals/HODPortal";
import FinancePortal from "./pages/portals/FinancePortal";
import AdminPortal from "./pages/portals/AdminPortal";
import SupplierPortal from "./pages/portals/SupplierPortal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup/company" element={<SignupCompany />} />
            <Route path="/signup/supplier" element={<SignupSupplier />} />
            <Route path="/invite" element={<Invite />} />

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

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
