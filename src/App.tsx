import React, { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/layout/AppLayout";
import AdminRoute from "@/components/AdminRoute";
import AdminLayout from "@/components/layout/AdminLayout";

// Loading spinner shown during lazy page loads
const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
  </div>
);

// Public pages
const Index = React.lazy(() => import("./pages/Index"));
const PricingPage = React.lazy(() => import("./pages/PricingPage"));
const HowItWorksPage = React.lazy(() => import("./pages/HowItWorksPage"));
const Login = React.lazy(() => import("./pages/Login"));
const Signup = React.lazy(() => import("./pages/Signup"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const Setup = React.lazy(() => import("./pages/Setup"));

// Protected pages
const SelectPlan = React.lazy(() => import("./pages/SelectPlan"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const Dashboard = React.lazy(() => import("./pages/Dashboard"));
const Campaigns = React.lazy(() => import("./pages/Campaigns"));
const CampaignNew = React.lazy(() => import("./pages/CampaignNew"));
const CampaignDetail = React.lazy(() => import("./pages/CampaignDetail"));
const Leads = React.lazy(() => import("./pages/Leads"));
const LeadDetail = React.lazy(() => import("./pages/LeadDetail"));
const Inbox = React.lazy(() => import("./pages/Inbox"));
const Calls = React.lazy(() => import("./pages/Calls"));
const Pipeline = React.lazy(() => import("./pages/Pipeline"));
const Proposals = React.lazy(() => import("./pages/Proposals"));
const Reports = React.lazy(() => import("./pages/Reports"));
const SettingsPage = React.lazy(() => import("./pages/Settings"));
const Billing = React.lazy(() => import("./pages/Billing"));
const SequenceDesigner = React.lazy(() => import("./pages/SequenceDesigner"));
const ProposalDetail = React.lazy(() => import("./pages/ProposalDetail"));

// Admin pages
const AdminDashboard = React.lazy(() => import("./pages/admin/AdminDashboard"));
const AdminClients = React.lazy(() => import("./pages/admin/AdminClients"));
const AdminAIConfig = React.lazy(() => import("./pages/admin/AdminAIConfig"));
const AdminEmailConfig = React.lazy(() => import("./pages/admin/AdminEmailConfig"));
const AdminBilling = React.lazy(() => import("./pages/admin/AdminBilling"));
const AdminSettings = React.lazy(() => import("./pages/admin/AdminSettings"));
const AdminActivity = React.lazy(() => import("./pages/admin/AdminActivity"));
const AdminClientDetail = React.lazy(() => import("./pages/admin/AdminClientDetail"));
const AdminDataSources = React.lazy(() => import("./pages/admin/AdminDataSources"));
const AdminAIAgentCenter = React.lazy(() => import("./pages/admin/AdminAIAgentCenter"));

const queryClient = new QueryClient();

const ProtectedWithLayout = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const AdminProtectedWithLayout = ({ children }: { children: React.ReactNode }) => (
  <AdminRoute>
    <AdminLayout>{children}</AdminLayout>
  </AdminRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public */}
              <Route path="/" element={<Index />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/setup" element={<Setup />} />

              {/* Protected - Full screen (no layout) */}
              <Route path="/select-plan" element={<ProtectedRoute><SelectPlan /></ProtectedRoute>} />
              <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
              <Route path="/campaigns/new" element={<ProtectedRoute><AppLayout><CampaignNew /></AppLayout></ProtectedRoute>} />
              <Route path="/campaigns/:id/sequence" element={<ProtectedRoute><AppLayout><SequenceDesigner /></AppLayout></ProtectedRoute>} />

              {/* Protected - With app layout */}
              <Route path="/dashboard" element={<ProtectedWithLayout><Dashboard /></ProtectedWithLayout>} />
              <Route path="/campaigns" element={<ProtectedWithLayout><Campaigns /></ProtectedWithLayout>} />
              <Route path="/campaigns/:id" element={<ProtectedWithLayout><CampaignDetail /></ProtectedWithLayout>} />
              <Route path="/leads" element={<ProtectedWithLayout><Leads /></ProtectedWithLayout>} />
              <Route path="/leads/:id" element={<ProtectedWithLayout><LeadDetail /></ProtectedWithLayout>} />
              <Route path="/inbox" element={<ProtectedWithLayout><Inbox /></ProtectedWithLayout>} />
              <Route path="/calls" element={<ProtectedWithLayout><Calls /></ProtectedWithLayout>} />
              <Route path="/pipeline" element={<ProtectedWithLayout><Pipeline /></ProtectedWithLayout>} />
              <Route path="/proposals" element={<ProtectedWithLayout><Proposals /></ProtectedWithLayout>} />
              <Route path="/proposals/:id" element={<ProtectedWithLayout><ProposalDetail /></ProtectedWithLayout>} />
              <Route path="/reports" element={<ProtectedWithLayout><Reports /></ProtectedWithLayout>} />
              <Route path="/settings" element={<ProtectedWithLayout><SettingsPage /></ProtectedWithLayout>} />
              <Route path="/billing" element={<ProtectedWithLayout><Billing /></ProtectedWithLayout>} />

              {/* Admin */}
              <Route path="/admin" element={<AdminProtectedWithLayout><AdminDashboard /></AdminProtectedWithLayout>} />
              <Route path="/admin/clients" element={<AdminProtectedWithLayout><AdminClients /></AdminProtectedWithLayout>} />
              <Route path="/admin/clients/:id" element={<AdminProtectedWithLayout><AdminClientDetail /></AdminProtectedWithLayout>} />
              <Route path="/admin/ai-agents" element={<AdminProtectedWithLayout><AdminAIAgentCenter /></AdminProtectedWithLayout>} />
              <Route path="/admin/ai-config" element={<AdminProtectedWithLayout><AdminAIConfig /></AdminProtectedWithLayout>} />
              <Route path="/admin/email-config" element={<AdminProtectedWithLayout><AdminEmailConfig /></AdminProtectedWithLayout>} />
              <Route path="/admin/billing" element={<AdminProtectedWithLayout><AdminBilling /></AdminProtectedWithLayout>} />
              <Route path="/admin/settings" element={<AdminProtectedWithLayout><AdminSettings /></AdminProtectedWithLayout>} />
              <Route path="/admin/activity" element={<AdminProtectedWithLayout><AdminActivity /></AdminProtectedWithLayout>} />
              <Route path="/admin/data-sources" element={<AdminProtectedWithLayout><AdminDataSources /></AdminProtectedWithLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
