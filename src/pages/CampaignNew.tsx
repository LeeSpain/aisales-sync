import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { supabase } from "@/integrations/supabase/client";
import ChatPanel from "@/components/chat/ChatPanel";
import { useToast } from "@/hooks/use-toast";
import { Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

/** Extract :::CAMPAIGN_JSON::: block from message */
function extractCampaignJSON(text: string): [string, Record<string, unknown> | null] {
  const regex = /:::CAMPAIGN_JSON:::\s*([\s\S]*?)\s*:::END_CAMPAIGN:::/;
  const match = text.match(regex);
  if (!match) return [text, null];
  try {
    const data = JSON.parse(match[1].trim());
    const clean = text.replace(regex, "").trim();
    return [clean, data];
  } catch {
    return [text, null];
  }
}

const CampaignNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const campaignCreatedRef = useRef(false);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*, companies(*)").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "campaign_setup",
    companyProfile: profile?.companies as Record<string, unknown> | null,
    initialMessages: [
      {
        role: "assistant",
        content: "Let's set up a new campaign! 🎯\n\nTell me — **who do you want to target?** What type of businesses or clients are you looking for? I'll help you define the perfect criteria, build a multi-channel outreach sequence, and get your pipeline moving.",
      },
    ],
  });

  // Watch for :::CAMPAIGN_JSON::: in assistant messages and create campaign
  useEffect(() => {
    if (campaignCreatedRef.current || !user || !profile?.company_id) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const [, campaignData] = extractCampaignJSON(lastAssistant.content);
    if (!campaignData) return;

    campaignCreatedRef.current = true;

    (async () => {
      try {
        const { data: newCampaign, error: campErr } = await supabase
          .from("campaigns")
          .insert({
            company_id: profile.company_id!,
            name: (campaignData.name as string) || "New Campaign",
            target_description: (campaignData.target_description as string) || null,
            geographic_focus: (campaignData.geographic_focus as string) || null,
            minimum_score: (campaignData.minimum_score as number) || 3.5,
            target_criteria: campaignData.target_criteria || null,
            status: "active",
          })
          .select("id")
          .single();

        if (campErr) {
          console.error("Failed to create campaign:", campErr.message);
          toast({ title: "Error", description: "Could not create campaign. Please try again.", variant: "destructive" });
          campaignCreatedRef.current = false;
          return;
        }

        toast({ title: "Campaign launched!", description: `"${campaignData.name}" is now active. Your AI is starting lead discovery.` });
        setTimeout(() => navigate(`/campaigns/${newCampaign.id}`), 2000);
      } catch (e) {
        console.error("Error creating campaign:", e);
        campaignCreatedRef.current = false;
      }
    })();
  }, [messages, user, profile, navigate, toast]);

  // Strip :::CAMPAIGN_JSON::: blocks from displayed messages
  const displayMessages = messages.map((m) => {
    if (m.role === "assistant" && m.content.includes(":::CAMPAIGN_JSON:::")) {
      const [clean] = extractCampaignJSON(m.content);
      return { ...m, content: clean };
    }
    return m;
  });

  return (
    <div className="flex h-[calc(100vh)] bg-background">
      {/* Side info */}
      <div className="hidden w-72 flex-col border-r border-border bg-card p-8 lg:flex">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Target className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mb-2 text-lg font-bold">New Campaign</h2>
        <p className="text-sm text-muted-foreground mb-8">
          The AI will help you define targets, build sector-specific strategy, design a multi-channel outreach sequence, and launch your campaign.
        </p>
        <div className="space-y-4">
          {["Target audience", "Sector strategy", "Geographic focus", "Outreach sequence", "Campaign name", "Launch"].map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full ${messages.length > (i + 1) * 2 ? "bg-success" : "bg-border"}`} />
              <span className={`text-sm ${messages.length > (i + 1) * 2 ? "text-foreground" : "text-muted-foreground"}`}>{step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat */}
      <div className="flex-1">
        <ChatPanel
          messages={displayMessages}
          isLoading={isLoading}
          error={error}
          onSend={sendMessage}
          onCancel={cancel}
          title="Campaign Setup"
          placeholder="Describe your target market..."
          fullScreen
        />
      </div>
    </div>
  );
};

export default CampaignNew;
