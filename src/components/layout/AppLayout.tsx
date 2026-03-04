import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ChatPanel from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Target, Users, Mail, Phone, Settings,
  LogOut, Zap, MessageCircle, CreditCard, FileText, BarChart3, Columns3, Shield, FlaskConical, Bot,
  Building2, Clock, Database, ArrowLeft, Menu, X,
} from "lucide-react";
import { useTestMode } from "@/hooks/useTestMode";
import { useDeadSwitch } from "@/hooks/useDeadSwitch";
import { useTheme } from "@/hooks/useTheme";
import { useBrandColors } from "@/hooks/useBrandColors";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const clientNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Campaigns", icon: Target, path: "/campaigns" },
  { label: "Leads", icon: Users, path: "/leads" },
  { label: "Pipeline", icon: Columns3, path: "/pipeline" },
  { label: "Proposals", icon: FileText, path: "/proposals" },
  { label: "Inbox", icon: Mail, path: "/inbox" },
  { label: "Calls", icon: Phone, path: "/calls" },
  { label: "Reports", icon: BarChart3, path: "/reports" },
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "Billing", icon: CreditCard, path: "/billing" },
];

const adminNavItems = [
  { label: "Dashboard", icon: Shield, path: "/admin" },
  { label: "Clients", icon: Building2, path: "/admin/clients" },
  { label: "AI Agents", icon: Bot, path: "/admin/ai-agents" },
  { label: "AI Config", icon: Zap, path: "/admin/ai-config" },
  { label: "Email Config", icon: Mail, path: "/admin/email-config" },
  { label: "Data Sources", icon: Database, path: "/admin/data-sources" },
  { label: "Billing", icon: CreditCard, path: "/admin/billing" },
  { label: "Activity Log", icon: Clock, path: "/admin/activity" },
  { label: "Settings", icon: Settings, path: "/admin/settings" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Get profile with company to check subscription status + pass to AI
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*, companies(*)").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Check if user is admin
  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });
  const isAdmin = roles?.some((r) => r.role === "admin");

  const { data: subscription } = useQuery({
    queryKey: ["subscription", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("status, current_period_end")
        .eq("company_id", profile!.company_id!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const isOnAdminRoute = location.pathname.startsWith("/admin");
  const activeNavItems = isOnAdminRoute ? adminNavItems : clientNavItems;

  /* ─── Onboarding guard: redirect incomplete users ─── */
  useEffect(() => {
    // Wait for data to load
    if (!profile || roles === undefined) return;
    // Admins on admin routes skip guard
    if (isAdmin && isOnAdminRoute) return;
    // Non-admin client checks
    if (!isOnAdminRoute) {
      if (!profile.company_id) {
        navigate("/select-plan", { replace: true });
        return;
      }
      if (!profile.onboarding_completed) {
        navigate("/onboarding", { replace: true });
        return;
      }
    }
  }, [profile, roles, isAdmin, isOnAdminRoute, navigate]);

  const { isTestMode } = useTestMode();
  const { isKilled: isDeadSwitchActive } = useDeadSwitch();
  // Initialize theme & brand colours on app load (reads from localStorage)
  useTheme();
  useBrandColors();
  const isTrial = subscription?.status === "trialing" || subscription?.status === "trial";
  const daysLeft = subscription?.current_period_end
    ? Math.max(0, Math.ceil((new Date(subscription.current_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  const contextMap: Record<string, any> = {
    "/dashboard": "dashboard",
    "/campaigns": "campaign_setup",
    "/leads": "dashboard",
    "/pipeline": "deal_review",
    "/proposals": "proposal_review",
    "/inbox": "reply_management",
    "/calls": "call_review",
    "/reports": "strategy",
    "/settings": "settings",
  };
  const currentContext = Object.entries(contextMap).find(([path]) =>
    location.pathname.startsWith(path)
  )?.[1] || "general";

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: currentContext,
    companyProfile: profile?.companies as Record<string, unknown> | null,
  });

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  /* ─── Sidebar content (shared between desktop & mobile) ─── */
  const sidebarContent = (
    <>
      <div className="flex h-16 items-center gap-2 border-b border-border px-6 cursor-pointer" onClick={() => handleNav(isOnAdminRoute ? "/admin" : "/dashboard")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold truncate">AI Sales Sync</span>
        {/* Close button — mobile only */}
        <button
          onClick={(e) => { e.stopPropagation(); setSidebarOpen(false); }}
          className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:bg-muted md:hidden"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {activeNavItems.map((item) => {
          const active = item.path === "/admin"
            ? location.pathname === "/admin"
            : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.label}
              onClick={() => handleNav(item.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}

        <div className="my-2 border-t border-border" />
        {isAdmin && !isOnAdminRoute && (
          <button
            onClick={() => handleNav("/admin")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Shield className="h-4 w-4" />
            Super Admin
          </button>
        )}
        {isOnAdminRoute && (
          <button
            onClick={() => handleNav("/dashboard")}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        )}
      </nav>

      <div className="border-t border-border p-3 space-y-1">
        {isAdmin && isDeadSwitchActive && (
          <div className="mb-2 px-3 py-2 text-xs font-bold text-red-400 flex items-center gap-2 bg-red-500/10 rounded-lg animate-pulse cursor-pointer" onClick={() => handleNav("/admin/ai-agents")}>
            <Bot className="h-3 w-3" />
            AI KILLED
          </div>
        )}
        {isAdmin && isTestMode && (
          <div className="mb-2 px-3 py-2 text-xs font-medium text-emerald-400 flex items-center gap-2 bg-emerald-500/10 rounded-lg">
            <FlaskConical className="h-3 w-3" />
            Test Mode Active
          </div>
        )}
        {isTrial && (
          <div className="mb-2 px-3 py-2 text-xs font-medium text-warning flex items-center gap-2 bg-warning/10 rounded-lg">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-warning"></span>
            </span>
            Trial: {daysLeft} days left
          </div>
        )}
        <div className="px-3 py-2 text-xs text-muted-foreground truncate">
          {user?.email}
        </div>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-border bg-card md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="flex h-14 items-center gap-3 border-b border-border px-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="font-bold text-sm">AI Sales Sync</span>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Floating chat */}
      {!chatOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-4 md:right-6 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg glow-primary z-30"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </motion.button>
      )}

      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-0 right-0 z-50 w-full sm:bottom-6 sm:right-4 md:right-6 sm:w-[400px]"
          >
            <ChatPanel
              messages={messages}
              isLoading={isLoading}
              error={error}
              onSend={sendMessage}
              onCancel={cancel}
              onClose={() => setChatOpen(false)}
              title="AI Assistant"
              placeholder="Ask the AI..."
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AppLayout;
