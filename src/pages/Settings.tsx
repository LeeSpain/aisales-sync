import { useState, KeyboardEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Briefcase, MessageSquare, SlidersHorizontal, MapPin, Save,
  Building2, FileText, ShieldCheck, Mail, Send, FileCheck, X, Pencil,
  Check, Lightbulb, Plus, Sun, Moon, Palette,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

// ─── Tag input helper ───
function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]; onAdd: (tag: string) => void; onRemove: (idx: number) => void; placeholder: string;
}) {
  const [input, setInput] = useState("");
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim());
      setInput("");
    }
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {tag}
            <button onClick={() => onRemove(i)} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="bg-background/50"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }}
          disabled={!input.trim()}
          className="shrink-0 gap-1"
        >
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>
    </div>
  );
}

// ─── Inline editable field ───
function EditableField({ label, value, icon: Icon, onSave, multiline }: {
  label: string; value: string; icon: React.ElementType; onSave: (val: string) => void; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    onSave(draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  return (
    <div className="group rounded-lg border border-transparent hover:border-border/50 p-2 -m-2 transition-colors">
      <div className="flex items-start gap-2">
        <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
          {editing ? (
            <div className="space-y-2">
              {multiline ? (
                <textarea
                  className="w-full rounded-lg bg-background border border-border p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                  rows={3}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                />
              ) : (
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="h-8 text-sm bg-background"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
                />
              )}
              <div className="flex gap-1.5">
                <Button size="sm" className="h-6 text-xs gap-1" onClick={save}><Check className="h-3 w-3" />Save</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={cancel}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <p className={cn("text-sm", value ? "font-medium" : "text-muted-foreground italic")}>{value || "Not set"}</p>
              <button
                onClick={() => { setDraft(value); setEditing(true); }}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const TONE_OPTIONS = [
  { value: "formal", label: "Formal" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
];

const AUTONOMY_OPTIONS = [
  { value: 1, label: "Conservative", desc: "AI asks before acting" },
  { value: 2, label: "Balanced", desc: "AI acts with oversight" },
  { value: 3, label: "Autonomous", desc: "AI acts independently" },
];

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [savingApproval, setSavingApproval] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("company_id").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: company } = useQuery({
    queryKey: ["company-profile", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("id", profile!.company_id!).single();
      if (data && !notesLoaded) {
        setNotes((data.ai_profile as Record<string, unknown>)?.notes as string || "");
        setNotesLoaded(true);
      }
      return data;
    },
    enabled: !!profile?.company_id,
  });

  // ─── Save helpers ───
  const updateCompanyField = async (field: string, value: unknown) => {
    if (!company) return;
    const { error } = await supabase.from("companies").update({ [field]: value }).eq("id", company.id);
    if (error) {
      toast({ title: "Error", description: `Failed to update ${field}.`, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: `${field.replace(/_/g, " ")} saved.` });
      queryClient.invalidateQueries({ queryKey: ["company-profile"] });
    }
  };

  const saveNotes = async () => {
    if (!company) return;
    setSavingNotes(true);
    const currentProfile = (company.ai_profile as Record<string, unknown>) || {};
    const { error: err } = await supabase
      .from("companies")
      .update({ ai_profile: { ...currentProfile, notes } })
      .eq("id", company.id);
    setSavingNotes(false);
    if (err) {
      toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Notes updated. The AI will use these as context." });
      queryClient.invalidateQueries({ queryKey: ["company-profile"] });
    }
  };

  // ─── Approval preferences ───
  const aiProfile = (company?.ai_profile as Record<string, unknown>) || {};
  const approval = (aiProfile.approval as Record<string, boolean>) || {};
  const autoSendOutreach = approval.auto_send_outreach ?? false;
  const autoSendProposals = approval.auto_send_proposals ?? false;
  const autoSendReplies = approval.auto_send_replies ?? false;

  const toggleApproval = async (key: string, current: boolean) => {
    if (!company) return;
    setSavingApproval(true);
    const currentProfile = (company.ai_profile as Record<string, unknown>) || {};
    const currentApproval = (currentProfile.approval as Record<string, boolean>) || {};
    const { error: err } = await supabase
      .from("companies")
      .update({ ai_profile: { ...currentProfile, approval: { ...currentApproval, [key]: !current } } })
      .eq("id", company.id);
    setSavingApproval(false);
    if (err) {
      toast({ title: "Error", description: "Failed to save preference.", variant: "destructive" });
    } else {
      toast({ title: "Updated", description: !current ? "Auto-send enabled" : "Approval required" });
      queryClient.invalidateQueries({ queryKey: ["company-profile"] });
    }
  };

  const services = Array.isArray(company?.services) ? company.services as string[] : [];
  const sellingPoints = Array.isArray(company?.selling_points) ? company.selling_points as string[] : [];
  const targetMarkets = Array.isArray(company?.target_markets) ? company.target_markets as string[] : [];

  if (!company) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Loading company profile...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-lg">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{company.name || "Company Profile"}</h1>
          <p className="text-sm text-muted-foreground">
            Your AI's knowledge base — everything here shapes how your AI sells, writes, and targets leads.
          </p>
        </div>
        <Badge className={cn(
          "text-xs uppercase tracking-wider",
          company.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"
        )}>
          {company.status ?? "setup"}
        </Badge>
      </div>

      {/* Theme Picker */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-3">
          {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> : theme === "brand" ? <Palette className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          <h3 className="text-sm font-semibold">Dashboard Theme</h3>
          <p className="text-xs text-muted-foreground ml-1">— saved locally to your browser</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Light */}
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              theme === "light"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100">
                <Sun className="h-3.5 w-3.5 text-amber-600" />
              </div>
              {theme === "light" && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-sm font-semibold">Light</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Clean, bright interface</p>
            <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
              <div className="h-1.5 bg-gray-100" />
              <div className="flex">
                <div className="w-5 bg-gray-50 h-6" />
                <div className="flex-1 bg-white h-6 p-1">
                  <div className="h-1 w-6 bg-gray-200 rounded" />
                </div>
              </div>
            </div>
          </button>

          {/* Dark */}
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              theme === "dark"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800">
                <Moon className="h-3.5 w-3.5 text-slate-300" />
              </div>
              {theme === "dark" && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-sm font-semibold">Dark</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Easy on the eyes</p>
            <div className="mt-2 rounded-lg border border-gray-700 overflow-hidden">
              <div className="h-1.5 bg-gray-900" />
              <div className="flex">
                <div className="w-5 bg-gray-800 h-6" />
                <div className="flex-1 bg-gray-900 h-6 p-1">
                  <div className="h-1 w-6 bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          </button>

          {/* Brand */}
          <button
            onClick={() => setTheme("brand")}
            className={cn(
              "rounded-xl border-2 p-4 text-left transition-all",
              theme === "brand"
                ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                : "border-border hover:border-muted-foreground/30"
            )}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
                <Palette className="h-3.5 w-3.5 text-white" />
              </div>
              {theme === "brand" && <span className="ml-auto text-[10px] font-semibold text-primary uppercase tracking-wide">Active</span>}
            </div>
            <p className="text-sm font-semibold">Brand</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Tinted with your colours</p>
            <div className="mt-2 rounded-lg border border-primary/30 overflow-hidden">
              <div className="h-1.5 bg-primary/20" />
              <div className="flex">
                <div className="w-5 bg-primary/10 h-6" />
                <div className="flex-1 bg-primary/5 h-6 p-1">
                  <div className="h-1 w-6 bg-primary/20 rounded" />
                </div>
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Top grid: Company Info + AI Config */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-1">
          <h3 className="text-sm font-semibold section-header-line mb-4">Company Info</h3>
          <div className="space-y-1">
            <EditableField label="Company Name" value={company.name || ""} icon={Building2} onSave={(v) => updateCompanyField("name", v)} />
            <EditableField label="Website" value={company.website || ""} icon={Globe} onSave={(v) => updateCompanyField("website", v)} />
            <EditableField label="Industry" value={company.industry || ""} icon={Briefcase} onSave={(v) => updateCompanyField("industry", v)} />
            <EditableField label="Geographic Range" value={company.geographic_range || ""} icon={MapPin} onSave={(v) => updateCompanyField("geographic_range", v)} />
            <EditableField label="Description" value={company.description || ""} icon={FileText} onSave={(v) => updateCompanyField("description", v)} multiline />
          </div>
        </div>

        {/* AI Configuration */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold section-header-line">AI Configuration</h3>

          {/* Tone */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Communication Tone</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.value}
                  onClick={() => updateCompanyField("tone_preference", t.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm transition-all",
                    company.tone_preference === t.value
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border hover:border-primary/50 text-muted-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Autonomy */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Autonomy Level</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {AUTONOMY_OPTIONS.map((a) => (
                <button
                  key={a.value}
                  onClick={() => updateCompanyField("autonomy_level", a.value)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-all",
                    company.autonomy_level === a.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <p className={cn("text-sm font-medium", company.autonomy_level === a.value ? "text-primary" : "")}>{a.label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <EditableField
            label="Pricing Summary"
            value={company.pricing_summary || ""}
            icon={FileText}
            onSave={(v) => updateCompanyField("pricing_summary", v)}
            multiline
          />
        </div>
      </div>

      {/* Middle grid: Services + Selling Points + Target Markets */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold section-header-line mb-3">Services</h3>
          <p className="text-xs text-muted-foreground mb-3">What your company offers. The AI uses these when writing outreach and proposals.</p>
          <TagInput
            tags={services}
            onAdd={(t) => updateCompanyField("services", [...services, t])}
            onRemove={(i) => updateCompanyField("services", services.filter((_, idx) => idx !== i))}
            placeholder="Add a service..."
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold section-header-line mb-3">Selling Points</h3>
          <p className="text-xs text-muted-foreground mb-3">Your competitive advantages. The AI highlights these in outreach.</p>
          <TagInput
            tags={sellingPoints}
            onAdd={(t) => updateCompanyField("selling_points", [...sellingPoints, t])}
            onRemove={(i) => updateCompanyField("selling_points", sellingPoints.filter((_, idx) => idx !== i))}
            placeholder="Add a selling point..."
          />
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold section-header-line mb-3">Target Markets</h3>
          <p className="text-xs text-muted-foreground mb-3">Who you want to sell to. Helps the AI find and qualify the right leads.</p>
          <TagInput
            tags={targetMarkets}
            onAdd={(t) => updateCompanyField("target_markets", [...targetMarkets, t])}
            onRemove={(i) => updateCompanyField("target_markets", targetMarkets.filter((_, idx) => idx !== i))}
            placeholder="Add a target market..."
          />
        </div>
      </div>

      {/* Bottom grid: Notes + Approval */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Notes — wider */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">AI Knowledge &amp; Notes</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Add anything the AI should know — pricing rules, processes, competitor info, special instructions. This is your AI's memory.
          </p>
          <textarea
            className="w-full rounded-lg bg-background/50 border border-border/50 p-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
            rows={8}
            placeholder="e.g. We offer 10% discount for annual contracts. Our main competitor is Acme Corp. Always mention 24/7 support. Don't target companies under 10 employees..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-[10px] text-muted-foreground">
              {notes.length > 0 ? `${notes.length} characters` : "No notes yet"} — saved to AI memory
            </p>
            <Button
              size="sm"
              className="gradient-primary border-0 text-white hover:opacity-90 gap-1.5"
              onClick={saveNotes}
              disabled={savingNotes}
            >
              <Save className="h-3.5 w-3.5" />
              {savingNotes ? "Saving..." : "Save to Memory"}
            </Button>
          </div>
        </div>

        {/* Approval Preferences */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Approval Preferences</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Choose what the AI can send automatically vs. what needs your review first.
          </p>

          <div className="space-y-3">
            {[
              { key: "auto_send_outreach", label: "Outreach Emails", desc: "Cold outreach sequences", icon: Mail, value: autoSendOutreach },
              { key: "auto_send_proposals", label: "Proposals", desc: "AI-generated proposals", icon: FileCheck, value: autoSendProposals },
              { key: "auto_send_replies", label: "Reply Drafts", desc: "Responses to leads", icon: Send, value: autoSendReplies },
            ].map(({ key, label, desc, icon: Icon, value }) => (
              <div key={key} className="flex items-center justify-between rounded-lg bg-background/50 border border-border/50 p-3">
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[10px] text-muted-foreground">{desc}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-[10px] font-medium", value ? "text-success" : "text-amber-400")}>
                    {value ? "Auto" : "Review"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={value}
                    disabled={savingApproval}
                    onClick={() => toggleApproval(key, value)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-50",
                      value ? "bg-success" : "bg-muted"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
                      value ? "translate-x-4.5" : "translate-x-0.5"
                    )} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/10 px-3 py-2 mt-4">
            <p className="text-[10px] text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" />
              "Review" means the AI creates drafts that wait for your approval.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
