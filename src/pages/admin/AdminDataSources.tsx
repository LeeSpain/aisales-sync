import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
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
    ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataSource {
    id: string;
    name: string;
    description: string;
    icon: typeof Database;
    category: "discovery" | "enrichment" | "verification";
    envName: string;
    url: string;
    usage: { limit: number; period: string };
}

const dataSources: DataSource[] = [
    {
        id: "google-places",
        name: "Google Places API",
        description: "Discover local businesses by location and category",
        icon: Globe,
        category: "discovery",
        envName: "GOOGLE_PLACES_API_KEY",
        url: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
        usage: { limit: 5000, period: "Monthly" },
    },
    {
        id: "serpapi",
        name: "SerpAPI",
        description: "Search engine results for lead research and discovery",
        icon: Search,
        category: "discovery",
        envName: "SERP_API_KEY",
        url: "https://serpapi.com/dashboard",
        usage: { limit: 2500, period: "Monthly" },
    },
    {
        id: "apollo",
        name: "Apollo.io",
        description: "Contact enrichment — LinkedIn profiles, direct dials, verified emails",
        icon: UserCheck,
        category: "enrichment",
        envName: "APOLLO_API_KEY",
        url: "https://app.apollo.io/#/settings/integrations/api",
        usage: { limit: 1000, period: "Monthly" },
    },
    {
        id: "hunter",
        name: "Hunter.io",
        description: "Email verification and pattern detection",
        icon: Mail,
        category: "verification",
        envName: "HUNTER_API_KEY",
        url: "https://hunter.io/api-keys",
        usage: { limit: 500, period: "Monthly" },
    },
];

const categoryLabels: Record<string, string> = {
    discovery: "Lead Discovery",
    enrichment: "Contact Enrichment",
    verification: "Email Verification",
};

const statusConfig = {
    connected: { label: "Connected", color: "bg-emerald-500/10 text-emerald-400", icon: CheckCircle2 },
    disconnected: { label: "Not Connected", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const AdminDataSources = () => {
    const { user } = useAuth();

    const { data: roles } = useQuery({
        queryKey: ["user-roles", user?.id],
        queryFn: async () => {
            const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
            return data || [];
        },
        enabled: !!user,
    });

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (roles && !isAdmin) return <Navigate to="/dashboard" replace />;

    const { data: configuredKeys } = useQuery({
        queryKey: ["admin-api-keys"],
        queryFn: async () => {
            const { data } = await supabase
                .from("ai_config")
                .select("*")
                .eq("purpose", "api_key_store");
            return data || [];
        },
        enabled: isAdmin,
    });

    const isKeyConfigured = (envName: string) => {
        return configuredKeys?.some((k) => k.provider === envName && k.is_active);
    };

    const categories = [...new Set(dataSources.map((ds) => ds.category))];

    return (
        <div className="p-4 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Data Sources</h1>
                    <p className="text-muted-foreground text-sm">Manage enrichment and discovery API integrations</p>
                </div>
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
                                const connected = isKeyConfigured(ds.envName);
                                const st = connected ? statusConfig.connected : statusConfig.disconnected;
                                const StIcon = st.icon;

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
                                                <div className="text-xs text-muted-foreground">
                                                    API Key: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{ds.envName}</code>
                                                    <span className="ml-3">Limit: {ds.usage.limit.toLocaleString()} / {ds.usage.period}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 shrink-0">
                                                <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
                                                    <a href={ds.url} target="_blank" rel="noopener noreferrer">
                                                        <ExternalLink className="h-3.5 w-3.5" />
                                                    </a>
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
