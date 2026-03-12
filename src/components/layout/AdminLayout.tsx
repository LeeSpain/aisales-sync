import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import {
    Users, Settings, LogOut, Zap, Activity, Mail, Database, CreditCard, LayoutDashboard
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { label: "Overview", icon: LayoutDashboard, path: "/admin" },
    { label: "Clients", icon: Users, path: "/admin/clients" },
    { label: "AI Config", icon: Activity, path: "/admin/ai-config" },
    { label: "Email Config", icon: Mail, path: "/admin/email-config" },
    { label: "Billing", icon: CreditCard, path: "/admin/billing" },
    { label: "Data Sources", icon: Database, path: "/admin/data-sources" },
    { label: "Activity Log", icon: Activity, path: "/admin/activity" },
    { label: "Settings", icon: Settings, path: "/admin/settings" },
];

interface AdminLayoutProps {
    children: React.ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
    const { user, signOut } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { theme } = useTheme();

    return (
        <div className={cn("flex min-h-screen bg-background", theme === "dark" || theme === "brand" ? "dark" : "")}>
            {/* Sidebar */}
            <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-card">
                <div className="flex h-16 items-center gap-2 border-b border-border px-6 cursor-pointer" onClick={() => navigate("/admin")}>
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                        <Zap className="h-4 w-4 text-white" />
                    </div>
                    <span className="font-bold">Admin Portal</span>
                </div>

                <nav className="flex-1 space-y-1 p-3">
                    {navItems.map((item) => {
                        const active = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path));
                        return (
                            <button
                                key={item.label}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                                    active
                                        ? "bg-red-600/10 text-red-600"
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
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground mb-2"
                    >
                        <LayoutDashboard className="h-4 w-4" />
                        User Dashboard
                    </button>

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
        </div>
    );
};

export default AdminLayout;
