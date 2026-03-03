import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import ChatPanel from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Target, Users, Mail, Phone, Settings,
  LogOut, Zap, MessageCircle, TrendingUp, UserCheck, MailOpen, PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Campaigns", icon: Target },
  { label: "Leads", icon: Users },
  { label: "Inbox", icon: Mail, badge: 0 },
  { label: "Calls", icon: Phone },
  { label: "Settings", icon: Settings },
];

const stats = [
  { label: "Leads Found", value: "—", icon: UserCheck, color: "text-primary" },
  { label: "Emails Sent", value: "—", icon: MailOpen, color: "text-accent" },
  { label: "Replies", value: "—", icon: TrendingUp, color: "text-success" },
  { label: "Calls Made", value: "—", icon: PhoneCall, color: "text-warning" },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "dashboard",
  });

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold">Media Sync</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full gradient-primary text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 p-8">
        <h1 className="mb-2 text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{user?.email ? `, ${user.email}` : ""}
        </p>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/30"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
              <p className="mt-2 text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* AI Briefing */}
        <div className="mt-8 rounded-xl border border-primary/20 bg-primary/5 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg gradient-primary">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold">AI Briefing</p>
              <p className="text-xs text-muted-foreground">Updated just now</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your AI sales engine is ready. Complete your first campaign setup to start discovering leads.
            Click the chat button to talk to your AI assistant about strategy, targets, or next steps.
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              className="gradient-primary border-0 text-white hover:opacity-90"
              onClick={() => setChatOpen(true)}
            >
              Talk to AI
            </Button>
            <Button size="sm" variant="outline">
              Create Campaign
            </Button>
          </div>
        </div>

        {/* Placeholder sections */}
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">Top Leads</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Leads will appear here once your first campaign runs
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="font-medium text-muted-foreground">Recent Activity</p>
            <p className="mt-1 text-sm text-muted-foreground/60">
              Campaign activity and AI actions will show here
            </p>
          </div>
        </div>
      </main>

      {/* Floating chat button */}
      {!chatOpen && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="fixed bottom-6 right-6 flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-lg glow-primary z-50"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </motion.button>
      )}

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50"
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

export default Dashboard;
