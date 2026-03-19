import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    ArrowLeft,
    Building2,
    Users2,
    Target,
    Mail,
    BarChart3,
    CreditCard,
    Calendar,
    Save,
    FileText,
    ShieldAlert,
    Package,
    Crosshair,
    Award,
    Globe,
    DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";

const AdminClientDetail = () => {
    const { id } = useParams<{ id: string }>();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [clientNotes, setClientNotes] = useState("");
    const [adminNotes, setAdminNotes] = useState("");
    const [notesLoaded, setNotesLoaded] = useState(false);
    const [savingNotes, setSavingNotes] = useState(false);

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
            if (data && !notesLoaded) {
                const aiProfile = (data.ai_profile as Record<string, unknown>) || {};
                setClientNotes((aiProfile.notes as string) || "");
                setAdminNotes((aiProfile.admin_notes as string) || "");
                setNotesLoaded(true);
            }
            return data;
        },
        enabled: !!id,
    });

    const saveNotes = async () => {
        if (!company) return;
        setSavingNotes(true);
        const currentProfile = (company.ai_profile as Record<string, unknown>) || {};
        const { error: err } = await supabase
            .from("companies")
            .update({ ai_profile: { ...currentProfile, notes: clientNotes, admin_notes: adminNotes } })
            .eq("id", company.id);
        setSavingNotes(false);
        if (err) {
            toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
        } else {
            toast({ title: "Saved", description: "Notes updated successfully." });
            queryClient.invalidateQueries({ queryKey: ["admin-company", id] });
        }
    };

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
        <div className="p-4 md:p-8">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-6 md:mb-8">
                <Button variant="ghost" size="icon" asChild className="shrink-0">
                    <Link to="/admin/clients">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-xl md:text-2xl font-bold truncate">{company.name}</h1>
                            <p className="text-sm text-muted-foreground truncate">
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
                            <p className="text-lg font-bold text-foreground">{stat.value}</p>
                        </div>
                    );
                })}
            </div>

            {/* Company details */}
            <div className="grid lg:grid-cols-2 gap-6 mb-8">
                {/* Company Info */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Company Info</h3>
                    <div className="space-y-3 text-sm">
                        <DetailRow label="Description" value={company.description} />
                        <DetailRow label="Website" value={company.website} />
                        <DetailRow label="Geographic Range" value={company.geographic_range} icon={<Globe className="h-3.5 w-3.5 text-cyan-400" />} />
                        <DetailRow label="Tone" value={company.tone_preference} capitalize />
                        <DetailRow label="Autonomy Level" value={company.autonomy_level != null ? `${company.autonomy_level}/10` : null} />
                        <DetailRow label="Created" value={new Date(company.created_at).toLocaleDateString()} />
                    </div>
                </div>

                {/* Subscription */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <h3 className="text-lg font-semibold mb-4">Subscription</h3>
                    {subscription ? (
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Plan</span>
                                <Badge variant="secondary" className="uppercase text-xs">{subscription.plan ?? "—"}</Badge>
                            </div>
                            <DetailRow label="Monthly" value={`€${subscription.monthly_amount ?? 0}`} icon={<DollarSign className="h-3.5 w-3.5 text-emerald-400" />} />
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Status</span>
                                <Badge className={cn("text-xs",
                                    subscription.status === "active" || subscription.status === "trialing" || subscription.status === "trial"
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : "bg-muted text-muted-foreground"
                                )}>{subscription.status ?? "—"}</Badge>
                            </div>
                            <DetailRow label="Setup Fee" value={subscription.setup_fee_paid ? "Paid" : "Unpaid"} />
                            {subscription.current_period_end && (
                                <DetailRow label="Period End" value={new Date(subscription.current_period_end).toLocaleDateString()} />
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No subscription found</p>
                    )}
                </div>
            </div>

            {/* Onboarding / Business Profile */}
            <div className="grid lg:grid-cols-3 gap-6 mb-8">
                {/* Services */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Package className="h-4 w-4 text-primary" />
                        <h3 className="font-semibold">Services / Products</h3>
                    </div>
                    {company.services && (company.services as string[]).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {(company.services as string[]).map((s: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Not set</p>
                    )}
                    {company.pricing_summary && (
                        <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-1">Pricing</p>
                            <p className="text-sm text-foreground">{company.pricing_summary}</p>
                        </div>
                    )}
                </div>

                {/* Target Markets */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Crosshair className="h-4 w-4 text-accent" />
                        <h3 className="font-semibold">Target Markets</h3>
                    </div>
                    {company.target_markets && (company.target_markets as string[]).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {(company.target_markets as string[]).map((t: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{t}</Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Not set</p>
                    )}
                </div>

                {/* Selling Points */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Award className="h-4 w-4 text-warning" />
                        <h3 className="font-semibold">Selling Points / USPs</h3>
                    </div>
                    {company.selling_points && (company.selling_points as string[]).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {(company.selling_points as string[]).map((s: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">Not set</p>
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
                                    <p className="font-medium text-foreground">{camp.name}</p>
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

            {/* Notes */}
            <div className="grid lg:grid-cols-2 gap-6 mt-8">
                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="h-4 w-4 text-primary" />
                        <h3 className="text-lg font-semibold">Client Notes</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Shared with the client. The AI uses these as context for outreach and proposals.</p>
                    <textarea
                        className="w-full rounded-lg bg-background/50 border border-border/50 p-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                        rows={5}
                        placeholder="Notes visible to client and AI..."
                        value={clientNotes}
                        onChange={(e) => setClientNotes(e.target.value)}
                    />
                </div>

                <div className="glass-card rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <ShieldAlert className="h-4 w-4 text-warning" />
                        <h3 className="text-lg font-semibold">Admin Notes</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">Only visible to super admins. Internal notes about this client.</p>
                    <textarea
                        className="w-full rounded-lg bg-background/50 border border-border/50 p-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                        rows={5}
                        placeholder="Internal admin notes..."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                    />
                </div>
            </div>
            <div className="mt-4">
                <Button
                    className="gradient-primary border-0 text-white hover:opacity-90 gap-1.5"
                    onClick={saveNotes}
                    disabled={savingNotes}
                >
                    <Save className="h-4 w-4" />
                    {savingNotes ? "Saving..." : "Save Notes"}
                </Button>
            </div>
        </div>
    );
};

/** Reusable detail row */
function DetailRow({ label, value, icon, capitalize: cap }: { label: string; value?: string | null; icon?: React.ReactNode; capitalize?: boolean }) {
    return (
        <div className="flex justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5">
                {icon}
                {label}
            </span>
            <span className={cn("text-foreground text-right max-w-[60%]", cap && "capitalize")}>{value || "—"}</span>
        </div>
    );
}

export default AdminClientDetail;
