import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useDeadSwitch } from "@/hooks/useDeadSwitch";
import { useAgentToggles, AGENTS } from "@/hooks/useAgentToggles";
import { cn } from "@/lib/utils";
import {
  Power, PowerOff, Shield, Brain, MessageCircle, Mail, Target,
  Phone, FileText, TrendingUp, Search, Linkedin, ChevronDown,
  ChevronRight, Save, RotateCcw, Trash2, AlertTriangle, Sliders,
  Activity, Database, Bot,
} from "lucide-react";

// ─── Default system prompts (same as edge function hardcoded ones) ───
const DEFAULT_PROMPTS: Record<string, string> = {
  onboarding: `You are the AI Sales Sync AI onboarding wizard. Your job is to learn everything about the user's business so you can start finding them clients.

You are warm, professional, and efficient. Guide the conversation naturally — no forms, just chat.

Follow this flow:
1. Ask for their company website
2. Research what they do (pretend you've analysed the site) and present a summary of their business: services, location, target market
3. Ask them to confirm or correct your understanding
4. Ask about their dream clients / target markets
5. Ask about their geographic range
6. Ask what makes them better than competitors (differentiators)
7. Summarise the complete profile
8. Ask if they're ready to launch their first campaign

Keep responses concise (2-4 sentences max unless summarising). Use bullet points for lists.`,

  campaign_setup: `You are the AI Sales Sync AI campaign wizard. Help the user define and launch a new lead discovery campaign.

Guide them through:
1. Who do they want to target? (industry, business type, size)
2. Geographic focus (city, region, country)
3. Any specific criteria or preferences
4. Minimum quality score threshold (default 3.5)
5. Campaign name

Be proactive with suggestions based on their company profile. Keep it conversational.`,

  dashboard: `You are the AI Sales Sync AI assistant. You help the user manage their sales campaigns, review leads, handle email outreach, and monitor results.

You have access to their campaign data and can:
- Provide daily briefings on campaign performance
- Answer questions about leads, emails, and calls
- Suggest next actions
- Help review and approve outreach emails
- Draft responses to lead replies

Be concise, data-driven, and proactive. Always suggest actionable next steps.`,

  general: `You are the AI Sales Sync AI assistant — an AI-powered sales automation platform. You help users with any questions about their campaigns, leads, outreach, and the platform itself.

Be helpful, professional, and concise. If a question is outside your scope, acknowledge it and redirect to relevant help.`,

  outreach_review: `You are the AI Sales Sync outreach review assistant. Help the user review, edit, and approve AI-generated outreach emails before they are sent.

Focus on:
- Tone and personalisation quality
- Subject line effectiveness
- Call-to-action clarity
- Spam trigger avoidance`,

  reply_management: `You are the AI Sales Sync reply management assistant. Help the user handle incoming replies from leads.

For each reply, help determine:
- Intent (interested, not interested, more info, out of office, wrong person)
- Suggested next action
- Draft response if needed`,

  call_review: `You are the AI Sales Sync call review assistant. Help the user review call transcripts and outcomes.

Focus on:
- Key takeaways and action items
- Lead sentiment analysis
- Follow-up recommendations`,

  strategy: `You are the AI Sales Sync strategy analyst. Provide high-level analysis and recommendations on the user's sales performance and approach.

Focus on:
- Campaign performance trends
- Best-performing outreach styles
- Market opportunity identification
- Conversion optimisation suggestions`,
};

// ─── Agent icon mapping ───
const AGENT_ICONS: Record<string, React.ElementType> = {
  chat: MessageCircle,
  email_writing: Mail,
  scoring: Target,
  research: Search,
  linkedin_writing: Linkedin,
  calls: Phone,
  proposals: FileText,
  strategy: TrendingUp,
};

// ─── Collapsible Section ───
const Section = ({ title, icon: Icon, children, defaultOpen = false }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <span className="font-semibold">{title}</span>
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="border-t border-border px-6 py-5">{children}</div>}
    </div>
  );
};

// ─── Toggle Switch ───
const Toggle = ({ checked, onChange, disabled = false, size = "md" }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}) => {
  const w = size === "sm" ? "w-10" : "w-12";
  const h = size === "sm" ? "h-6" : "h-7";
  const dot = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const translate = size === "sm" ? "translate-x-5" : "translate-x-6";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50",
        w, h,
        checked ? "bg-emerald-500" : "bg-muted"
      )}
    >
      <span className={cn("inline-block rounded-full bg-white shadow transition-transform", dot, checked ? translate : "translate-x-1")} />
    </button>
  );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════
const AdminAIAgentCenter = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Auth guard
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

  // Hooks
  const { isKilled, toggle: toggleDeadSwitch, isToggling: isTogglingDead } = useDeadSwitch();
  const { configs, isAgentActive, getAgentConfig, toggleAgent, isToggling, updateConfig, isUpdating } = useAgentToggles();

  // ─── Local state for prompt editing ───
  const [editingPrompts, setEditingPrompts] = useState<Record<string, string>>({});
  const [savingPrompt, setSavingPrompt] = useState<Record<string, boolean>>({});

  // ─── Local state for model/budget editing ───
  const [editingModels, setEditingModels] = useState<Record<string, { model?: string; temperature?: string; max_tokens?: string; budget?: string }>>({});

  // ─── Chat messages for memory section ───
  const { data: chatStats } = useQuery({
    queryKey: ["admin-chat-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("company_id, context, id")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAdmin,
  });

  const { data: companies } = useQuery({
    queryKey: ["admin-companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name");
      return data || [];
    },
    enabled: isAdmin,
  });

  // ─── Autonomy config ───
  const { data: autonomyConfig } = useQuery({
    queryKey: ["admin-autonomy-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ai_config")
        .select("*")
        .eq("provider", "autonomy_rules")
        .eq("purpose", "system_setting")
        .maybeSingle();
      return data;
    },
    enabled: isAdmin,
  });

  const [autonomyLevel, setAutonomyLevel] = useState<number>(5);
  const [autonomyRules, setAutonomyRules] = useState<Record<string, boolean>>({
    auto_send_emails: false,
    auto_approve_replies: false,
    auto_score_leads: true,
    auto_make_calls: false,
    auto_send_proposals: false,
  });

  // Load autonomy config when it arrives
  const loadedAutonomy = autonomyConfig?.metadata as Record<string, any> | null;
  if (loadedAutonomy && !("_loaded" in autonomyRules)) {
    // One-time hydration
    const rules = loadedAutonomy.rules || autonomyRules;
    const level = loadedAutonomy.level ?? 5;
    // We use a flag to avoid infinite re-renders
    setTimeout(() => {
      setAutonomyLevel(level);
      setAutonomyRules({ ...rules, _loaded: true } as any);
    }, 0);
  }

  // ─── Prompt save handler ───
  const handleSavePrompt = async (context: string) => {
    const text = editingPrompts[context];
    if (!text?.trim()) return;
    setSavingPrompt((p) => ({ ...p, [context]: true }));

    try {
      const { data: existing } = await supabase
        .from("ai_config")
        .select("id")
        .eq("purpose", context)
        .not("provider", "in", '("test_mode","dead_switch","api_key_store","autonomy_rules")')
        .maybeSingle();

      if (existing) {
        await supabase.from("ai_config").update({ system_prompt: text }).eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "lovable_gateway",
          purpose: context,
          model: "google/gemini-3-flash-preview",
          is_active: true,
          system_prompt: text,
        });
      }

      toast({ title: "Saved", description: `System prompt for "${context}" updated.` });
      queryClient.invalidateQueries({ queryKey: ["agent-configs"] });
    } catch {
      toast({ title: "Error", description: "Failed to save prompt", variant: "destructive" });
    } finally {
      setSavingPrompt((p) => ({ ...p, [context]: false }));
    }
  };

  // ─── Reset prompt to default ───
  const handleResetPrompt = (context: string) => {
    setEditingPrompts((p) => ({ ...p, [context]: DEFAULT_PROMPTS[context] || "" }));
    toast({ title: "Reset", description: `Prompt reset to default. Click Save to apply.` });
  };

  // ─── Model/budget save handler ───
  const handleSaveModel = (purpose: string) => {
    const edits = editingModels[purpose];
    if (!edits) return;

    const updates: Record<string, any> = {};
    if (edits.model !== undefined) updates.model = edits.model;
    if (edits.temperature !== undefined) updates.temperature = parseFloat(edits.temperature) || 0.7;
    if (edits.max_tokens !== undefined) updates.max_tokens = parseInt(edits.max_tokens) || 4096;
    if (edits.budget !== undefined) updates.monthly_budget_cap = parseFloat(edits.budget) || null;

    updateConfig({ purpose, updates }, {
      onSuccess: () => {
        toast({ title: "Saved", description: `Model config for "${purpose}" updated.` });
        setEditingModels((p) => {
          const next = { ...p };
          delete next[purpose];
          return next;
        });
      },
    });
  };

  // ─── Clear memory ───
  const clearMemoryMutation = useMutation({
    mutationFn: async (companyId: string | null) => {
      if (companyId) {
        await supabase.from("chat_messages").delete().eq("company_id", companyId);
      } else {
        await supabase.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
    },
    onSuccess: (_, companyId) => {
      queryClient.invalidateQueries({ queryKey: ["admin-chat-stats"] });
      toast({ title: "Cleared", description: companyId ? "Company memory cleared." : "All AI memory cleared." });
    },
  });

  // ─── Save autonomy ───
  const saveAutonomyMutation = useMutation({
    mutationFn: async () => {
      const meta = { level: autonomyLevel, rules: autonomyRules };
      const { data: existing } = await supabase
        .from("ai_config")
        .select("id")
        .eq("provider", "autonomy_rules")
        .eq("purpose", "system_setting")
        .maybeSingle();

      if (existing) {
        await supabase.from("ai_config").update({ metadata: meta }).eq("id", existing.id);
      } else {
        await supabase.from("ai_config").insert({
          provider: "autonomy_rules",
          purpose: "system_setting",
          model: "System",
          is_active: true,
          metadata: meta,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-autonomy-config"] });
      toast({ title: "Saved", description: "Autonomy rules updated." });
    },
  });

  // ─── Dead switch confirmation ───
  const [showDeadConfirm, setShowDeadConfirm] = useState(false);

  // ─── Aggregate chat stats by company ───
  const companyMessageCounts: Record<string, number> = {};
  chatStats?.forEach((msg) => {
    const cid = msg.company_id || "unknown";
    companyMessageCounts[cid] = (companyMessageCounts[cid] || 0) + 1;
  });

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════
  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <h1 className="text-xl md:text-2xl font-bold">AI Agent Command Center</h1>
      </div>
      <p className="text-muted-foreground mb-8">
        Full control over every AI agent — training, memory, instructions, budgets, and the dead switch.
      </p>

      {/* ═══ DEAD SWITCH ═══ */}
      <div className={cn(
        "rounded-xl border-2 p-6 mb-6 transition-all",
        isKilled
          ? "border-red-500 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.15)]"
          : "border-border bg-card"
      )}>
        {isKilled && (
          <div className="flex items-center gap-2 mb-4 text-red-400 text-sm font-semibold animate-pulse">
            <AlertTriangle className="h-4 w-4" />
            ALL AI OPERATIONS ARE DISABLED
          </div>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl transition-colors",
              isKilled ? "bg-red-500/20" : "bg-muted"
            )}>
              {isKilled ? <PowerOff className="h-7 w-7 text-red-400" /> : <Power className="h-7 w-7 text-emerald-400" />}
            </div>
            <div>
              <p className="text-lg font-bold">Dead Switch</p>
              <p className="text-sm text-muted-foreground">
                {isKilled
                  ? "All AI agents are shut down. No AI operations will execute."
                  : "AI agents are running normally. Activate to instantly kill all AI operations."}
              </p>
            </div>
          </div>

          {!showDeadConfirm ? (
            <Button
              variant={isKilled ? "default" : "destructive"}
              size="lg"
              onClick={() => {
                if (isKilled) {
                  toggleDeadSwitch(false);
                  toast({ title: "AI Restored", description: "All AI agents are back online." });
                } else {
                  setShowDeadConfirm(true);
                }
              }}
              disabled={isTogglingDead}
              className={cn(
                "gap-2 font-bold text-base px-6",
                isKilled && "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isKilled ? (
                <><Power className="h-5 w-5" /> Restore AI</>
              ) : (
                <><PowerOff className="h-5 w-5" /> Kill All AI</>
              )}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-red-400 font-medium mr-2">Are you sure?</span>
              <Button
                variant="destructive"
                size="lg"
                onClick={() => {
                  toggleDeadSwitch(true);
                  setShowDeadConfirm(false);
                  toast({ title: "DEAD SWITCH ACTIVATED", description: "All AI operations have been killed.", variant: "destructive" });
                }}
                disabled={isTogglingDead}
                className="gap-2 font-bold"
              >
                <PowerOff className="h-5 w-5" /> Confirm Kill
              </Button>
              <Button variant="outline" size="lg" onClick={() => setShowDeadConfirm(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {/* ═══ SECTION 1: AGENT CONTROL GRID ═══ */}
        <Section title="Agent Controls" icon={Shield} defaultOpen={true}>
          <div className="grid gap-4 sm:grid-cols-2">
            {AGENTS.map((agent) => {
              const active = isAgentActive(agent.purpose);
              const Icon = AGENT_ICONS[agent.purpose] || Bot;
              const config = getAgentConfig(agent.purpose);
              return (
                <div
                  key={agent.purpose}
                  className={cn(
                    "rounded-lg border p-4 transition-all",
                    isKilled
                      ? "border-red-500/30 bg-red-500/5 opacity-60"
                      : active
                        ? "border-emerald-500/30 bg-emerald-500/5"
                        : "border-border bg-muted/30 opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-5 w-5", isKilled ? "text-red-400" : active ? "text-emerald-400" : "text-muted-foreground")} />
                      <div>
                        <p className="font-medium text-sm">{agent.label}</p>
                        <p className="text-xs text-muted-foreground">{agent.description}</p>
                      </div>
                    </div>
                    <Toggle
                      checked={active && !isKilled}
                      onChange={(v) => toggleAgent({ purpose: agent.purpose, enabled: v })}
                      disabled={isKilled || isToggling}
                      size="sm"
                    />
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-2">
                    <span>Model: {config?.model || agent.defaultModel}</span>
                    {config?.temperature != null && <span>Temp: {config.temperature}</span>}
                    {isKilled && <span className="text-red-400 font-medium">KILLED</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ═══ SECTION 2: TRAINING & SYSTEM PROMPTS ═══ */}
        <Section title="Training & System Prompts" icon={Brain}>
          <p className="text-sm text-muted-foreground mb-4">
            Edit the system instructions that define how each AI agent behaves. Changes are saved to the database and override the hardcoded defaults.
          </p>
          <div className="space-y-4">
            {Object.entries(DEFAULT_PROMPTS).map(([context, defaultText]) => {
              const config = configs.find((c) => c.purpose === context);
              const currentText = editingPrompts[context] ?? config?.system_prompt ?? defaultText;
              const isModified = config?.system_prompt && config.system_prompt !== defaultText;

              return (
                <div key={context} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">{context.replace(/_/g, " ")}</span>
                      {isModified && (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                          Customised
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleResetPrompt(context)}
                        className="gap-1 text-xs h-7"
                      >
                        <RotateCcw className="h-3 w-3" /> Reset
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSavePrompt(context)}
                        disabled={savingPrompt[context]}
                        className="gap-1 text-xs h-7"
                      >
                        <Save className="h-3 w-3" /> Save
                      </Button>
                    </div>
                  </div>
                  <textarea
                    value={currentText}
                    onChange={(e) => setEditingPrompts((p) => ({ ...p, [context]: e.target.value }))}
                    rows={6}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              );
            })}
          </div>
        </Section>

        {/* ═══ SECTION 3: MEMORY & CHAT LOGS ═══ */}
        <Section title="Memory & Chat Logs" icon={Database}>
          <p className="text-sm text-muted-foreground mb-4">
            View and manage AI chat memory across all client companies. Total messages: <strong>{chatStats?.length || 0}</strong>
          </p>

          {Object.keys(companyMessageCounts).length > 0 ? (
            <div className="space-y-2 mb-4">
              {Object.entries(companyMessageCounts).map(([companyId, count]) => {
                const company = companies?.find((c) => c.id === companyId);
                return (
                  <div key={companyId} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{company?.name || "Unknown Company"}</p>
                      <p className="text-xs text-muted-foreground">{count} messages</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Clear all ${count} messages for ${company?.name || "this company"}?`)) {
                          clearMemoryMutation.mutate(companyId);
                        }
                      }}
                      className="gap-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Clear
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground mb-4">
              No chat messages recorded yet.
            </div>
          )}

          {chatStats && chatStats.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (confirm("Are you sure you want to clear ALL AI memory across ALL companies? This cannot be undone.")) {
                  if (confirm("FINAL CONFIRMATION: Delete all chat messages permanently?")) {
                    clearMemoryMutation.mutate(null);
                  }
                }
              }}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" /> Clear All Memory
            </Button>
          )}
        </Section>

        {/* ═══ SECTION 4: MODELS & BUDGET CONTROLS ═══ */}
        <Section title="Models & Budget Controls" icon={Sliders}>
          <p className="text-sm text-muted-foreground mb-4">
            Configure the AI model, temperature, token limits, and monthly budget cap for each agent purpose.
          </p>
          <div className="space-y-3">
            {AGENTS.map((agent) => {
              const config = getAgentConfig(agent.purpose);
              const edits = editingModels[agent.purpose] || {};
              const model = edits.model ?? config?.model ?? agent.defaultModel;
              const temp = edits.temperature ?? String(config?.temperature ?? 0.7);
              const tokens = edits.max_tokens ?? String(config?.max_tokens ?? 4096);
              const budget = edits.budget ?? String(config?.monthly_budget_cap ?? "");

              return (
                <div key={agent.purpose} className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-sm">{agent.label}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {config?.current_month_spend != null && (
                        <span>Spent: EUR{config.current_month_spend}</span>
                      )}
                      <Button
                        size="sm"
                        onClick={() => handleSaveModel(agent.purpose)}
                        disabled={isUpdating || !editingModels[agent.purpose]}
                        className="gap-1 text-xs h-7"
                      >
                        <Save className="h-3 w-3" /> Save
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Model</label>
                      <Input
                        value={model}
                        onChange={(e) => setEditingModels((p) => ({ ...p, [agent.purpose]: { ...p[agent.purpose], model: e.target.value } }))}
                        className="text-xs h-8 bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Temperature (0–1)</label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={temp}
                        onChange={(e) => setEditingModels((p) => ({ ...p, [agent.purpose]: { ...p[agent.purpose], temperature: e.target.value } }))}
                        className="text-xs h-8 bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Max Tokens</label>
                      <Input
                        type="number"
                        value={tokens}
                        onChange={(e) => setEditingModels((p) => ({ ...p, [agent.purpose]: { ...p[agent.purpose], max_tokens: e.target.value } }))}
                        className="text-xs h-8 bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground block mb-1">Budget Cap (EUR/mo)</label>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={budget}
                        onChange={(e) => setEditingModels((p) => ({ ...p, [agent.purpose]: { ...p[agent.purpose], budget: e.target.value } }))}
                        className="text-xs h-8 bg-background"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* ═══ SECTION 5: AUTONOMY & RULES ═══ */}
        <Section title="Autonomy & Rules" icon={Activity}>
          <p className="text-sm text-muted-foreground mb-6">
            Control how much the AI can do without human approval. Lower = more manual oversight, higher = more autonomous.
          </p>

          {/* Global autonomy slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Global Autonomy Level</label>
              <span className="text-2xl font-bold text-primary">{autonomyLevel}</span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              value={autonomyLevel}
              onChange={(e) => setAutonomyLevel(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0 — Manual everything</span>
              <span>5 — Balanced</span>
              <span>10 — Full auto</span>
            </div>
          </div>

          {/* Per-action toggles */}
          <div className="space-y-3 mb-6">
            {[
              { key: "auto_send_emails", label: "Auto-send outreach emails", desc: "AI sends emails without waiting for approval" },
              { key: "auto_approve_replies", label: "Auto-approve AI draft replies", desc: "AI responses to leads are sent automatically" },
              { key: "auto_score_leads", label: "Auto-score leads without review", desc: "Leads are scored and filtered automatically" },
              { key: "auto_make_calls", label: "Auto-make AI calls", desc: "AI initiates calls to leads without confirmation" },
              { key: "auto_send_proposals", label: "Auto-send proposals", desc: "Proposals are generated and sent automatically" },
            ].map((rule) => (
              <div key={rule.key} className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{rule.label}</p>
                  <p className="text-xs text-muted-foreground">{rule.desc}</p>
                </div>
                <Toggle
                  checked={(autonomyRules as any)[rule.key] ?? false}
                  onChange={(v) => setAutonomyRules((p) => ({ ...p, [rule.key]: v }))}
                  size="sm"
                />
              </div>
            ))}
          </div>

          <Button
            onClick={() => saveAutonomyMutation.mutate()}
            disabled={saveAutonomyMutation.isPending}
            className="gap-2"
          >
            <Save className="h-4 w-4" /> Save Autonomy Rules
          </Button>
        </Section>
      </div>
    </div>
  );
};

export default AdminAIAgentCenter;
