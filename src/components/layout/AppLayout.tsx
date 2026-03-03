import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import ChatPanel from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Target, Users, Mail, Phone, Settings,
  LogOut, Zap, MessageCircle, CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
  { label: "Campaigns", icon: Target, path: "/campaigns" },
  { label: "Leads", icon: Users, path: "/leads" },
  { label: "Inbox", icon: Mail, path: "/inbox" },
  { label: "Calls", icon: Phone, path: "/calls" },
  { label: "Settings", icon: Settings, path: "/settings" },
  { label: "Billing", icon: CreditCard, path: "/billing" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [chatOpen, setChatOpen] = useState(false);

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "dashboard",
  });

  return (
    <div className="flex min-h-screen bg-background dark">
      {/* Sidebar */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-6 cursor-pointer" onClick={() => navigate("/dashboard")}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold">Media Sync</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
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
        </nav>

        <div className="border-t border-border p-3 space-y-1">
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
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Floating chat */}
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

export default AppLayout;
