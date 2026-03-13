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
    Power,
    PowerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DataSource {
    id: string;
    name: string;
    description: string;
    icon: typeof Database;
    category: "discovery" | "enrichment" | "verification";
    keyName: string;
    providerName: string;
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
        keyName: "GOOGLE_PLACES_API_KEY",
        providerName: "google_places",
        url: "https://console.cloud.google.com/apis/library/places-backend.googleapis.com",
        usage: { limit: 5000, period: "Monthly" },
    },
    {
        id: "serper",
        name: "Serper",
        description: "Search engine results for lead research and discovery",
        icon: Search,
        category: "discovery",
        keyName: "serper_api_key",
        providerName: "serper",
        url: "https://serper.dev",
        usage: { limit: 2500, period: "Monthly" },
    },
    {
        id: "apollo",
        name: "Apollo.io",
        description: "Contact enrichment — LinkedIn profiles, direct dials, verified emails",
        icon: UserCheck,
        category: "enrichment",
        keyName: "APOLLO_API_KEY",
        providerName: "apollo",
        url: "https://app.apollo.io/#/settings/integrations/api",
        usage: { limit: 1000, period: "Monthly" },
    },
    {
        id: "hunter",
        name: "Hunter.io",
        description: "Email verification and pattern detection",
        icon: Mail,
        category: "verification",
        keyName: "HUNTER_API_KEY",
        providerName: "",
        url: "https://hunter.io/api-keys",
        usage: { limit: 500, period: "Monthly" },
    },
];

const categoryLabels: Record<string, string> = {
    discovery: "Lead Discovery",
    enrichment: "Contact Enrichment",
    verification: "Email Verification",
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

    // Read from api_keys table (admin-only via RLS)
    const { data: storedKeys } = useQuery({
        queryKey: ["admin-api-keys"],
        queryFn: async () => {
            const { data } = await supabase
                .from("api_keys")
                .select("key_name, is_active, updated_at")
                .eq("is_active", true);
            return data || [];
        },
        enabled: isAdmin,
    });

    // Read from provider_configs for enabled/disabled state
    const { data: providerConfigs } = useQuery({
        queryKey: ["provider-configs-datasources"],
        queryFn: async () => {
            const { data } = await supabase
                .from("provider_configs")
                .select("provider_name, is_enabled, updated_at");
            return data || [];
        },
        enabled: isAdmin,
    });

    const isKeyConfigured = (keyName: string) => {
        return storedKeys?.some((k) => k.key_name === keyName && k.is_active);
    };

    const isProviderEnabled = (providerName: string) => {
        if (!providerName) return false;
        const config = providerConfigs?.find((c) => c.provider_name === providerName);
        return config?.is_enabled ?? false;
    };

    const getLastUpdated = (keyName: string, providerName: string) => {
        const keyUpdate = storedKeys?.find((k) => k.key_name === keyName)?.updated_at;
        const configUpdate = providerConfigs?.find((c) => c.provider_name === providerName)?.updated_at;
        const latest = [keyUpdate, configUpdate].filter(Boolean).sort().pop();
        if (!latest) return null;
        return new Date(latest).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
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
                                const hasKey = isKeyConfigured(ds.keyName);
                                const enabled = isProviderEnabled(ds.providerName);
                                const lastUpdated = getLastUpdated(ds.keyName, ds.providerName);

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
                                                <div className="flex items-center gap-3 mb-1 flex-wrap">
                                                    <h3 className="font-semibold">{ds.name}</h3>
                                                    <Badge className={cn(
                                                        "text-[10px]",
                                                        hasKey
                                                            ? "bg-emerald-500/10 text-emerald-400"
                                                            : "bg-muted text-muted-foreground"
                                                    )}>
                                                        {hasKey
                                                            ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Key Set</>
                                                            : <><XCircle className="h-3 w-3 mr-1" /> No Key</>
                                                        }
                                                    </Badge>
                                                    {ds.providerName && (
                                                        <Badge className={cn(
                                                            "text-[10px]",
                                                            enabled
                                                                ? "bg-blue-500/10 text-blue-400"
                                                                : "bg-muted text-muted-foreground"
                                                        )}>
                                                            {enabled
                                                                ? <><Power className="h-3 w-3 mr-1" /> Enabled</>
                                                                : <><PowerOff className="h-3 w-3 mr-1" /> Disabled</>
                                                            }
                                                        </Badge>
                                                    )}
                                                </div>
                                                <p className="text-sm text-muted-foreground mb-3">{ds.description}</p>
                                                <div className="text-xs text-muted-foreground">
                                                    API Key: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{ds.keyName}</code>
                                                    <span className="ml-3">Limit: {ds.usage.limit.toLocaleString()} / {ds.usage.period}</span>
                                                    {lastUpdated && (
                                                        <span className="ml-3">Updated: {lastUpdated}</span>
                                                    )}
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
