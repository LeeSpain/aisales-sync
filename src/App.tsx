import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";

// Public pages
import Index from "./pages/Index";
import PricingPage from "./pages/PricingPage";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Protected pages
import Onboarding from "./pages/Onboarding";
import Dashboard from "./pages/Dashboard";
import Campaigns from "./pages/Campaigns";
import CampaignNew from "./pages/CampaignNew";
import CampaignDetail from "./pages/CampaignDetail";
import Leads from "./pages/Leads";
import LeadDetail from "./pages/LeadDetail";
import Inbox from "./pages/Inbox";
import Calls from "./pages/Calls";
import SettingsPage from "./pages/Settings";
import Billing from "./pages/Billing";

// Admin pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAIConfig from "./pages/admin/AdminAIConfig";
import AdminActivity from "./pages/admin/AdminActivity";

const queryClient = new QueryClient();

const ProtectedWithLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected - Full screen (no layout) */}
            <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
            <Route path="/campaigns/new" element={<ProtectedRoute><AppLayout><CampaignNew /></AppLayout></ProtectedRoute>} />

            {/* Protected - With app layout */}
            <Route path="/dashboard" element={<ProtectedWithLayout><Dashboard /></ProtectedWithLayout>} />
            <Route path="/campaigns" element={<ProtectedWithLayout><Campaigns /></ProtectedWithLayout>} />
            <Route path="/campaigns/:id" element={<ProtectedWithLayout><CampaignDetail /></ProtectedWithLayout>} />
            <Route path="/leads" element={<ProtectedWithLayout><Leads /></ProtectedWithLayout>} />
            <Route path="/leads/:id" element={<ProtectedWithLayout><LeadDetail /></ProtectedWithLayout>} />
            <Route path="/inbox" element={<ProtectedWithLayout><Inbox /></ProtectedWithLayout>} />
            <Route path="/calls" element={<ProtectedWithLayout><Calls /></ProtectedWithLayout>} />
            <Route path="/settings" element={<ProtectedWithLayout><SettingsPage /></ProtectedWithLayout>} />
            <Route path="/billing" element={<ProtectedWithLayout><Billing /></ProtectedWithLayout>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedWithLayout><AdminDashboard /></ProtectedWithLayout>} />
            <Route path="/admin/clients" element={<ProtectedWithLayout><AdminDashboard /></ProtectedWithLayout>} />
            <Route path="/admin/ai-config" element={<ProtectedWithLayout><AdminAIConfig /></ProtectedWithLayout>} />
            <Route path="/admin/activity" element={<ProtectedWithLayout><AdminActivity /></ProtectedWithLayout>} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
