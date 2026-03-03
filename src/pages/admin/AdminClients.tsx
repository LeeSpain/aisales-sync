import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, Navigate } from "react-router-dom";
import { Users, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const AdminClients = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

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

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  const filtered = companies?.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">{companies?.length || 0} total clients</p>
        </div>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-background"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="grid grid-cols-5 gap-4 border-b border-border px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <span>Company</span>
          <span>Industry</span>
          <span>Plan</span>
          <span>Status</span>
          <span>Users</span>
        </div>
        {filtered.length > 0 ? (
          <div className="divide-y divide-border">
            {filtered.map((company) => {
              const userCount = profiles?.filter((p) => p.company_id === company.id).length || 0;
              return (
                <div
                  key={company.id}
                  className="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => navigate(`/admin/clients/${company.id}`)}
                >
                  <div>
                    <p className="font-medium text-sm">{company.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{company.website || "No website"}</p>
                  </div>
                  <span className="text-sm text-muted-foreground self-center">{company.industry || "—"}</span>
                  <span className="text-sm self-center capitalize">{company.subscription_plan || "Free"}</span>
                  <span className={`text-sm self-center capitalize ${company.status === "active" ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {company.status || "—"}
                  </span>
                  <div className="flex items-center gap-1 self-center">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm">{userCount}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">No clients found</div>
        )}
      </div>
    </div>
  );
};

export default AdminClients;
