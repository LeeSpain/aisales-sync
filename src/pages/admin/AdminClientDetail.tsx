import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    ArrowLeft,
    Building2,
    Users2,
    Target,
    Mail,
    BarChart3,
    CreditCard,
    Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AdminClientDetail = () => {
    const { id } = useParams<{ id: string }>();

    // Fetch company
    const { data: company, isLoading } = useQuery({
        queryKey: ["admin-company", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("companies")
                .select("*")
                .eq("id", id!)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Fetch company campaigns
    const { data: campaigns } = useQuery({
        queryKey: ["admin-company-campaigns", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("campaigns")
                .select("*")
                .eq("company_id", id!)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Fetch company leads count
    const { data: leads } = useQuery({
        queryKey: ["admin-company-leads", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("leads")
                .select("id, status, score", { count: "exact" })
                .eq("company_id", id!);
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // Fetch subscription
    const { data: subscription } = useQuery({
        queryKey: ["admin-company-subscription", id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("subscriptions")
                .select("*")
                .eq("company_id", id!)
                .maybeSingle();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <div className="animate-pulse text-muted-foreground">Loading client...</div>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="p-8 text-center">
                <p className="text-muted-foreground">Client not found</p>
                <Button asChild className="mt-4" variant="outline">
                    <Link to="/admin/clients">Back to Clients</Link>
                </Button>
            </div>
        );
    }

    const totalLeads = leads?.length ?? 0;
    const qualifiedLeads = leads?.filter((l) => l.status === "qualified").length ?? 0;
    const totalCampaigns = campaigns?.length ?? 0;

    const stats = [
        { label: "Campaigns", value: totalCampaigns, icon: Target, color: "text-primary" },
        { label: "Total Leads", value: totalLeads, icon: Users2, color: "text-blue-400" },
        { label: "Qualified", value: qualifiedLeads, icon: BarChart3, color: "text-emerald-400" },
        { label: "Plan", value: subscription?.plan ?? "None", icon: CreditCard, color: "text-amber-400" },
    ];

    return (
        <div className="p-8 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/admin/clients">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">{company.name}</h1>
                            <p className="text-sm text-muted-foreground">
                                {company.industry ?? "Unknown industry"} · {company.website ?? "No website"}
                            </p>
                        </div>
                    </div>
                </div>
                <Badge
                    className={cn(
                        "text-xs uppercase tracking-wider",
                        company.status === "active"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    {company.status ?? "unknown"}
                </Badge>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                {stats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                        <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                                <Icon className={cn("h-3.5 w-3.5", stat.color)} />
                                {stat.label}
                            </div>
                            <p className="text-lg font-bold text-white">{stat.value}</p>
                        </div>
                    );
                })}
            </div>

            {/* Company details */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Company Info</h3>
                    <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Description</span>
                            <span className="text-white text-right max-w-[60%]">{company.description ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Geographic Range</span>
                            <span className="text-white">{company.geographic_range ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Tone</span>
                            <span className="text-white capitalize">{company.tone_preference ?? "—"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Autonomy Level</span>
                            <span className="text-white">{company.autonomy_level ?? "—"}/10</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Created</span>
                            <span className="text-white">{new Date(company.created_at).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Subscription</h3>
                    {subscription ? (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Plan</span>
                                <Badge variant="secondary" className="uppercase text-xs">{subscription.plan ?? "—"}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Monthly</span>
                                <span className="text-white">£{subscription.monthly_amount ?? 0}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge className={cn("text-xs",
                                    subscription.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
                                )}>{subscription.status ?? "—"}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Setup Fee</span>
                                <span className="text-white">{subscription.setup_fee_paid ? "Paid" : "Unpaid"}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No subscription found</p>
                    )}
                </div>
            </div>

            {/* Campaigns */}
            <div className="rounded-xl border border-border bg-card p-6">
                <h3 className="text-lg font-semibold mb-4">Campaigns ({totalCampaigns})</h3>
                {campaigns && campaigns.length > 0 ? (
                    <div className="space-y-3">
                        {campaigns.map((camp) => (
                            <div key={camp.id} className="flex items-center justify-between rounded-lg border border-border p-4 hover:border-primary/30 transition-colors">
                                <div>
                                    <p className="font-medium text-white">{camp.name}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {camp.leads_found ?? 0} leads · {camp.emails_sent ?? 0} emails · {camp.replies_received ?? 0} replies
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Badge variant="secondary" className="text-xs capitalize">{camp.status ?? "draft"}</Badge>
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">{new Date(camp.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No campaigns yet</p>
                )}
            </div>
        </div>
    );
};

export default AdminClientDetail;
