import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ChatPanel from "@/components/chat/ChatPanel";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Settings as SettingsIcon, Globe, Briefcase, Target, MessageSquare,
  SlidersHorizontal, MapPin, Save, Building2, FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SettingsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState("");
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);

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

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "settings",
    initialMessages: [
      {
        role: "assistant",
        content: "Welcome to settings! Just tell me what you'd like to change. I can update your:\n\n- **Company profile** — name, services, targets\n- **Tone preference** — formal, professional, casual, friendly\n- **Autonomy level** — how much freedom the AI has\n- **Geographic range** — where to find leads\n\nWhat would you like to adjust?",
      },
    ],
  });

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

  const services = Array.isArray(company?.services) ? company.services : [];
  const sellingPoints = Array.isArray(company?.selling_points) ? company.selling_points : [];
  const targetMarkets = Array.isArray(company?.target_markets) ? company.target_markets : [];

  const toneLabels: Record<string, string> = {
    formal: "Formal",
    professional: "Professional",
    casual: "Casual",
    friendly: "Friendly",
  };

  const autonomyLabels: Record<number, string> = {
    1: "Conservative — AI asks before acting",
    2: "Balanced — AI acts with oversight",
    3: "Autonomous — AI acts independently",
  };

  return (
    <div className="flex h-[calc(100vh)]">
      {/* Left: Company Profile */}
      <div className="w-[420px] shrink-0 flex-col border-r border-border overflow-y-auto hidden lg:flex">
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Company Profile</h2>
              <p className="text-xs text-muted-foreground">Your AI's knowledge base</p>
            </div>
          </div>

          {/* Company Info */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold section-header-line">Company Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Name</p>
                  <p className="font-medium">{company?.name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Website</p>
                  <p className="font-medium">{company?.website || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Briefcase className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Industry</p>
                  <p className="font-medium">{company?.industry || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Geographic Range</p>
                  <p className="font-medium">{company?.geographic_range || "Not set"}</p>
                </div>
              </div>
              {company?.description && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-muted-foreground text-xs mb-1">Description</p>
                  <p className="text-sm leading-relaxed">{company.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Services & Selling Points */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold section-header-line">Services & Strengths</h3>
            {services.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1.5">Services</p>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s: string, i: number) => (
                    <span key={i} className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {sellingPoints.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1.5">Selling Points</p>
                <div className="flex flex-wrap gap-1.5">
                  {sellingPoints.map((s: string, i: number) => (
                    <span key={i} className="rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {targetMarkets.length > 0 && (
              <div>
                <p className="text-muted-foreground text-xs mb-1.5">Target Markets</p>
                <div className="flex flex-wrap gap-1.5">
                  {targetMarkets.map((s: string, i: number) => (
                    <span key={i} className="rounded-full bg-success/10 text-success px-2.5 py-0.5 text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {services.length === 0 && sellingPoints.length === 0 && targetMarkets.length === 0 && (
              <p className="text-sm text-muted-foreground">No services or targets set yet. Use the AI chat to add them.</p>
            )}
          </div>

          {/* AI Configuration */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold section-header-line">AI Configuration</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Tone</p>
                  <p className="font-medium">{toneLabels[company?.tone_preference || ""] || "Professional"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-muted-foreground text-xs">Autonomy Level</p>
                  <p className="font-medium">{autonomyLabels[company?.autonomy_level || 1]}</p>
                </div>
              </div>
              {company?.pricing_summary && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Pricing Summary</p>
                    <p className="font-medium">{company.pricing_summary}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Notes / Knowledge */}
          <div className="glass-card rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold section-header-line">Notes &amp; Knowledge</h3>
            <p className="text-xs text-muted-foreground">Add context the AI should know — processes, key clients, pricing details, special instructions.</p>
            <textarea
              className="w-full rounded-lg bg-background/50 border border-border/50 p-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              rows={5}
              placeholder="e.g. We offer a 10% discount for annual contracts. Our main competitor is Acme Corp. Always mention our 24/7 support..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <Button
              size="sm"
              className="w-full gradient-primary border-0 text-white hover:opacity-90 gap-1.5"
              onClick={saveNotes}
              disabled={savingNotes}
            >
              <Save className="h-3.5 w-3.5" />
              {savingNotes ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </div>

      {/* Right: AI Chat */}
      <div className="flex-1">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          error={error}
          onSend={sendMessage}
          onCancel={cancel}
          title="Settings"
          placeholder="Tell the AI what to change..."
          fullScreen
        />
      </div>
    </div>
  );
};

export default SettingsPage;
