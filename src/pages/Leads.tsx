import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Users, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  scored: "bg-primary/10 text-primary",
  qualified: "bg-success/10 text-success",
  contacted: "bg-accent/10 text-accent",
  replied: "bg-warning/10 text-warning",
  converted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  unresponsive: "bg-muted text-muted-foreground",
};

const Leads = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: leads, isLoading } = useQuery({
    queryKey: ["leads", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("*").eq("company_id", profile!.company_id!).order("score", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const filtered = leads?.filter((l) => {
    const matchSearch = !search || l.business_name.toLowerCase().includes(search.toLowerCase()) || l.city?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    return matchSearch && matchStatus;
  }) || [];

  const statuses = ["all", "discovered", "scored", "qualified", "contacted", "replied", "converted", "rejected"];

  return (
    <div className="p-4 md:p-8">
      <h1 className="text-xl md:text-2xl font-bold mb-2">Leads</h1>
      <p className="text-muted-foreground mb-6">All discovered leads across campaigns</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-colors",
              statusFilter === s ? "gradient-primary text-white" : "bg-muted text-muted-foreground hover:text-foreground"
            )}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>
      ) : filtered.length > 0 ? (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Business</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Source</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <td className="px-4 py-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                      {lead.score?.toFixed(1) || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{lead.business_name}</p>
                    <p className="text-xs text-muted-foreground">{lead.industry}</p>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-muted-foreground">{lead.city}, {lead.country}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground capitalize">{lead.source?.replace("_", " ")}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", statusColors[lead.status] || "bg-muted text-muted-foreground")}>
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No leads found</h3>
          <p className="text-sm text-muted-foreground">Leads will appear once your campaigns start discovering prospects</p>
        </div>
      )}
    </div>
  );
};

export default Leads;
