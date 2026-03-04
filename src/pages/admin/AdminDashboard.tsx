import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Users, Target, DollarSign, Activity, Building2, Settings, Mail, CreditCard, Clock, Shield, Zap, ClipboardList, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ─── Admin To-Do types & helpers ─── */
interface AdminTodo {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

const STORAGE_KEY = "ais-admin-todos";

function loadTodos(): AdminTodo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTodos(todos: AdminTodo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  /* ─── To-Do state ─── */
  const [todoOpen, setTodoOpen] = useState(false);
  const [todos, setTodos] = useState<AdminTodo[]>(loadTodos);
  const [newTask, setNewTask] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => { saveTodos(todos); }, [todos]);
  useEffect(() => { if (editingId && editRef.current) editRef.current.focus(); }, [editingId]);

  const addTodo = () => {
    const text = newTask.trim();
    if (!text) return;
    setTodos((prev) => [{ id: crypto.randomUUID(), text, done: false, createdAt: Date.now() }, ...prev]);
    setNewTask("");
  };

  const toggleTodo = (id: string) => setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const deleteTodo = (id: string) => setTodos((prev) => prev.filter((t) => t.id !== id));

  const startEdit = (todo: AdminTodo) => { setEditingId(todo.id); setEditText(todo.text); };

  const saveEdit = () => {
    if (!editingId) return;
    const text = editText.trim();
    if (text) setTodos((prev) => prev.map((t) => (t.id === editingId ? { ...t, text } : t)));
    setEditingId(null);
    setEditText("");
  };

  const cancelEdit = () => { setEditingId(null); setEditText(""); };

  const pendingCount = todos.filter((t) => !t.done).length;

  // Check admin role
  const { data: roles } = useQuery({
    queryKey: ["user-roles", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const isAdmin = roles?.some((r) => r.role === "admin");

  if (roles && !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: allCompanies } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allCampaigns } = useQuery({
    queryKey: ["admin-campaigns"],
    queryFn: async () => {
      const { data } = await supabase.from("campaigns").select("id, status");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allLeads } = useQuery({
    queryKey: ["admin-leads-count"],
    queryFn: async () => {
      const { data } = await supabase.from("leads").select("id");
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: allSubscriptions } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select("plan, status, monthly_amount");
      return data || [];
    },
    enabled: isAdmin,
  });

  const activeCampaigns = allCampaigns?.length || 0;
  const totalLeads = allLeads?.length || 0;
  const mrr = allSubscriptions
    ?.filter((s) => s.status === "active" || s.status === "trialing" || s.status === "trial")
    .reduce((sum, s) => sum + (s.monthly_amount || 0), 0) || 0;

  const revenueByPlan = (() => {
    if (!allSubscriptions?.length) return [];
    const planMap: Record<string, { count: number; revenue: number }> = {};
    allSubscriptions.forEach((s) => {
      const plan = s.plan || "No Plan";
      if (!planMap[plan]) planMap[plan] = { count: 0, revenue: 0 };
      planMap[plan].count += 1;
      planMap[plan].revenue += s.monthly_amount || 0;
    });
    return Object.entries(planMap).map(([plan, data]) => ({
      plan: plan.charAt(0).toUpperCase() + plan.slice(1),
      clients: data.count,
      revenue: data.revenue,
    }));
  })();

  const cards = [
    { label: "Total Clients", value: allCompanies?.length || 0, icon: Users, color: "text-primary", bg: "bg-primary/15", path: "/admin/clients" },
    { label: "Active Campaigns", value: activeCampaigns, icon: Target, color: "text-accent", bg: "bg-accent/15", path: "/admin/clients" },
    { label: "Revenue (MRR)", value: `\u20AC${mrr.toLocaleString()}`, icon: DollarSign, color: "text-success", bg: "bg-success/15", path: "/admin/billing" },
    { label: "Total Leads", value: totalLeads, icon: Activity, color: "text-warning", bg: "bg-warning/15", path: "/admin/clients" },
  ];

  const navItems = [
    { label: "Clients", path: "/admin/clients", icon: Building2 },
    { label: "AI Agents", path: "/admin/ai-agents", icon: Shield },
    { label: "AI Config", path: "/admin/ai-config", icon: Zap },
    { label: "Email Config", path: "/admin/email-config", icon: Mail },
    { label: "Billing", path: "/admin/billing", icon: CreditCard },
    { label: "Settings", path: "/admin/settings", icon: Settings },
    { label: "Activity Log", path: "/admin/activity", icon: Clock },
  ];

  const chartColors = [
    "hsl(239 84% 67%)",
    "hsl(187 92% 69%)",
    "hsl(160 84% 39%)",
    "hsl(38 92% 50%)",
    "hsl(234 89% 74%)",
  ];

  const planColorMap: Record<string, string> = {
    starter: "text-primary bg-primary/10",
    growth: "text-accent bg-accent/10",
    pro: "text-success bg-success/10",
    enterprise: "text-warning bg-warning/10",
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">
              <span className="gradient-text">Super Admin</span>
            </h1>
            <p className="text-sm text-muted-foreground">Platform overview and management</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setTodoOpen(true)}
            className="shrink-0 gap-2 border-primary/30 hover:bg-primary/10"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">To Do List</span>
            {pendingCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            onClick={() => navigate(card.path)}
            className="card-glow rounded-xl p-5 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className={cn("icon-bg rounded-xl", card.bg)}>
                <card.icon className={cn("h-5 w-5", card.color)} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{card.label}</p>
                <p className="text-2xl font-bold mt-0.5">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className="glass-card rounded-xl px-4 py-3 text-sm font-medium hover:bg-white/5 transition-all flex flex-col items-center gap-2 group"
          >
            <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Content Grid: Chart + Client List */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Revenue by Plan Chart */}
        <div className="glass-card rounded-xl p-6">
          <h3 className="font-semibold mb-4 section-header-line">Revenue by Plan</h3>
          {revenueByPlan.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPlan} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 14% 18%)" />
                  <XAxis
                    dataKey="plan"
                    tick={{ fill: "hsl(240 10% 60%)", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(240 14% 18%)" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "hsl(240 10% 60%)", fontSize: 12 }}
                    axisLine={{ stroke: "hsl(240 14% 18%)" }}
                    tickLine={false}
                    tickFormatter={(v) => `\u20AC${v}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(240 17% 8%)",
                      border: "1px solid hsl(240 14% 18%)",
                      borderRadius: "0.75rem",
                      color: "hsl(240 10% 96%)",
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`\u20AC${value.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueByPlan.map((entry, index) => (
                      <Cell key={entry.plan} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center py-12 text-center">
              <DollarSign className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No subscription data yet</p>
            </div>
          )}
        </div>

        {/* Client List */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
            <h3 className="font-semibold section-header-line">All Clients</h3>
            <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full">{allCompanies?.length || 0}</span>
          </div>
          {allCompanies && allCompanies.length > 0 ? (
            <div className="divide-y divide-white/5 max-h-80 overflow-y-auto">
              {allCompanies.map((company) => {
                const planClasses = planColorMap[company.subscription_plan?.toLowerCase() || ""] || "text-muted-foreground bg-muted/50";
                return (
                  <div
                    key={company.id}
                    className="flex items-center justify-between px-6 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                    onClick={() => navigate(`/admin/clients/${company.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary uppercase">
                        {company.name?.charAt(0) || "?"}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{company.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.industry || "No industry"}{company.status ? ` \u00B7 ${company.status}` : ""}
                        </p>
                      </div>
                    </div>
                    <span className={cn("rounded-full px-2.5 py-1 text-[10px] font-medium capitalize", planClasses)}>
                      {company.subscription_plan || "No plan"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">No clients yet</div>
          )}
        </div>
      </div>

      {/* ─── To Do List Dialog ─── */}
      <Dialog open={todoOpen} onOpenChange={setTodoOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 border-border">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="h-5 w-5 text-primary" />
              Admin To Do List
              {pendingCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>Track tasks, ideas, and action items for your platform.</DialogDescription>
          </DialogHeader>

          {/* Add new task */}
          <div className="flex gap-2 px-5 py-3 border-b border-border bg-muted/30">
            <input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              placeholder="Add a new task..."
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground outline-none focus:border-primary transition-colors"
            />
            <Button size="sm" onClick={addTodo} disabled={!newTask.trim()} className="gap-1.5 gradient-primary border-0 text-white hover:opacity-90">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1 min-h-0">
            {todos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">No tasks yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Add your first task above to get started</p>
              </div>
            ) : (
              <>
                {/* Pending tasks first, then completed */}
                {[...todos.filter((t) => !t.done), ...todos.filter((t) => t.done)].map((todo) => (
                  <div
                    key={todo.id}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/50",
                      todo.done && "opacity-50"
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => toggleTodo(todo.id)}
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        todo.done
                          ? "border-primary bg-primary text-white"
                          : "border-muted-foreground/40 hover:border-primary"
                      )}
                    >
                      {todo.done && <Check className="h-3 w-3" />}
                    </button>

                    {/* Text or edit input */}
                    {editingId === todo.id ? (
                      <div className="flex flex-1 gap-2">
                        <input
                          ref={editRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit();
                            if (e.key === "Escape") cancelEdit();
                          }}
                          className="flex-1 rounded-md border border-primary bg-background px-2 py-1 text-sm outline-none"
                        />
                        <button onClick={saveEdit} className="rounded-md p-1.5 text-primary hover:bg-primary/10">
                          <Check className="h-4 w-4" />
                        </button>
                        <button onClick={cancelEdit} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={cn("flex-1 text-sm leading-relaxed", todo.done && "line-through")}>
                          {todo.text}
                        </span>
                        {/* Action buttons (visible on hover / always on touch) */}
                        <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity sm:opacity-0 [.group:active_&]:opacity-100">
                          <button
                            onClick={() => startEdit(todo)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteTodo(todo.id)}
                            className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Footer stats */}
          {todos.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border text-xs text-muted-foreground">
              <span>{todos.filter((t) => t.done).length} of {todos.length} completed</span>
              {todos.some((t) => t.done) && (
                <button
                  onClick={() => setTodos((prev) => prev.filter((t) => !t.done))}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  Clear completed
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
