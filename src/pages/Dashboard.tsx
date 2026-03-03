import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Target, Users, Mail, Phone, Settings, LogOut, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Campaigns", icon: Target },
  { label: "Leads", icon: Users },
  { label: "Inbox", icon: Mail, badge: 0 },
  { label: "Calls", icon: Phone },
  { label: "Settings", icon: Settings },
];

const Dashboard = () => {
  const { user, signOut } = useAuth();

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
          Welcome back{user?.email ? `, ${user.email}` : ""}. Your AI sales engine is getting ready.
        </p>

        <div className="mt-12 rounded-2xl border border-dashed border-border p-12 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            🚀 Complete onboarding to activate your AI sales engine
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            Phase 2 will add the AI wizard, campaign management, and lead discovery.
          </p>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
