import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Database,
    Globe,
    Search,
    UserCheck,
    Mail,
    CheckCircle2,
    XCircle,
    RefreshCw,
    Settings2,
    ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */
interface DataSource {
    id: string;
    name: string;
    description: string;
    icon: typeof Database;
    category: "discovery" | "enrichment" | "verification";
    status: "connected" | "disconnected" | "error";
    apiKeySet: boolean;
    usage: { current: number; limit: number; period: string };
    lastChecked?: string;
    url: string;
}

/* ─── Demo data (will be replaced by Supabase data_sources table) ─── */
const dataSources: DataSource[] = [
    {
        id: "google-places",
        name: "Google Places API",
        description: "Discover local businesses by location and category",
        icon: Globe,
        category: "discovery",
        status: "connected",
        apiKeySet: true,
        usage: { current: 1240, limit: 5000, period: "Monthly" },
        lastChecked: "2 min ago",
        url: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
    },
    {
        id: "serpapi",
        name: "SerpAPI",
        description: "Search engine results for lead research and discovery",
        icon: Search,
        category: "discovery",
        status: "connected",
        apiKeySet: true,
        usage: { current: 820, limit: 2500, period: "Monthly" },
        lastChecked: "5 min ago",
        url: "https://serpapi.com/dashboard",
    },
    {
        id: "apollo",
        name: "Apollo.io",
        description: "Contact enrichment — LinkedIn profiles, direct dials, verified emails, company data",
        icon: UserCheck,
        category: "enrichment",
        status: "connected",
        apiKeySet: true,
        usage: { current: 450, limit: 1000, period: "Monthly" },
        lastChecked: "1 min ago",
        url: "https://app.apollo.io/#/settings/integrations/api",
    },
    {
        id: "hunter",
        name: "Hunter.io",
        description: "Email verification and pattern detection",
        icon: Mail,
        category: "verification",
        status: "disconnected",
        apiKeySet: false,
        usage: { current: 0, limit: 500, period: "Monthly" },
        url: "https://hunter.io/api-keys",
    },
];

const categoryLabels: Record<string, string> = {
    discovery: "Lead Discovery",
    enrichment: "Contact Enrichment",
    verification: "Email Verification",
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    connected: { label: "Connected", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
    disconnected: { label: "Not Connected", color: "bg-muted text-muted-foreground", icon: XCircle },
    error: { label: "Error", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

const AdminDataSources = () => {
    const categories = [...new Set(dataSources.map((ds) => ds.category))];

    return (
        <div className="p-8 max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Data Sources</h1>
                    <p className="text-muted-foreground text-sm">Manage enrichment and discovery API integrations</p>
                </div>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Health Check All
                </Button>
            </div>

            {categories.map((cat) => (
                <div key={cat} className="mb-8">
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                        {categoryLabels[cat] ?? cat}
                    </h2>
                    <div className="space-y-4">
                        {dataSources
                            .filter((ds) => ds.category === cat)
                            .map((ds) => {
                                const Icon = ds.icon;
                                const st = statusConfig[ds.status];
                                const StIcon = st.icon;
                                const usagePercent = ds.usage.limit > 0 ? Math.round((ds.usage.current / ds.usage.limit) * 100) : 0;

                                return (
                                    <div
                                        key={ds.id}
                                        className="rounded-xl border border-border bg-card p-6 hover:border-primary/20 transition-colors"
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                                <Icon className="h-5 w-5 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="font-semibold text-white">{ds.name}</h3>
                                                    <Badge className={cn("text-[10px]", st.color)}>
                                                        <StIcon className="h-3 w-3 mr-1" />
                                                        {st.label}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-3">{ds.description}</p>

                                                {/* Usage bar */}
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 max-w-xs">
                                                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                            <span>{ds.usage.current.toLocaleString()} / {ds.usage.limit.toLocaleString()}</span>
                                                            <span>{ds.usage.period}</span>
                                                        </div>
                                                        <div className="h-1.5 rounded-full bg-border overflow-hidden">
                                                            <div
                                                                className={cn(
                                                                    "h-full rounded-full transition-all",
                                                                    usagePercent > 80 ? "bg-amber-400" : "bg-primary"
                                                                )}
                                                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                    {ds.lastChecked && (
                                                        <span className="text-[11px] text-muted-foreground/60">
                                                            Checked {ds.lastChecked}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                    <a href={ds.url} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
                                                </Button>
                                                <Button variant="outline" size="sm" className="gap-1.5">
                                                    <Settings2 className="h-3.5 w-3.5" />
                                                    Configure
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default AdminDataSources;
