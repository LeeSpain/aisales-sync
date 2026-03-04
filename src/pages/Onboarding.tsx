import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { supabase } from "@/integrations/supabase/client";
import ChatPanel from "@/components/chat/ChatPanel";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/** Extract :::PROFILE_JSON::: block from message and return [cleanText, parsedData | null] */
function extractProfileJSON(text: string): [string, Record<string, unknown> | null] {
  const regex = /:::PROFILE_JSON:::\s*([\s\S]*?)\s*:::END_PROFILE:::/;
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

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const profileSavedRef = useRef(false);

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "onboarding",
    initialMessages: [
      {
        role: "assistant",
        content:
          "Welcome to AI Sales Sync! 🚀 I'm your AI sales team. I'm going to learn everything about your business so I can start finding clients, running outreach, and building your pipeline.\n\nThis takes about 5 minutes. Let's start simple — **what's your company website?**",
      },
    ],
  });

  // Watch for :::PROFILE_JSON::: in assistant messages and save to DB
  useEffect(() => {
    if (profileSavedRef.current || !user) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const [, profileData] = extractProfileJSON(lastAssistant.content);
    if (!profileData) return;

    profileSavedRef.current = true;

    (async () => {
      try {
        // Get user's company_id
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single();

        if (!profile?.company_id) {
          console.error("No company_id found for user");
          return;
        }

        // Update company with extracted business profile
        const { error: updateErr } = await supabase
          .from("companies")
          .update({
            website: (profileData.website as string) || null,
            industry: (profileData.industry as string) || null,
            description: (profileData.description as string) || null,
            services: profileData.services || null,
            selling_points: profileData.selling_points || null,
            target_markets: profileData.target_markets || null,
            geographic_range: (profileData.geographic_range as string) || null,
            pricing_summary: (profileData.pricing_summary as string) || null,
            tone_preference: (profileData.tone_preference as string) || null,
          })
          .eq("id", profile.company_id);

        if (updateErr) {
          console.error("Failed to save company profile:", updateErr.message);
          toast({ title: "Warning", description: "Could not save business profile. You can update it in settings.", variant: "destructive" });
        } else {
          toast({ title: "Business profile saved", description: "Your AI sales team now knows your business." });
        }
      } catch (e) {
        console.error("Error saving profile:", e);
      }
    })();
  }, [messages, user, toast]);

  // Update quick replies based on message count
  useEffect(() => {
    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    if (assistantCount <= 1) {
      setQuickReplies([]);
    } else if (assistantCount === 2) {
      setQuickReplies(["That's spot on", "Close but needs adjusting"]);
    } else if (assistantCount >= 5) {
      setQuickReplies(["Launch first campaign", "Edit profile first"]);
    } else {
      setQuickReplies([]);
    }
  }, [messages]);

  const handleSend = useCallback(
    async (text: string) => {
      sendMessage(text);
      setQuickReplies([]);

      // Check if onboarding is complete (user says launch/ready/dashboard)
      const lower = text.toLowerCase();
      if (
        lower.includes("launch") ||
        lower.includes("dashboard") ||
        lower.includes("go to dashboard")
      ) {
        // Mark onboarding complete
        if (user) {
          await supabase
            .from("profiles")
            .update({ onboarding_completed: true })
            .eq("id", user.id);
        }
        setTimeout(() => navigate("/dashboard"), 2000);
      }
    },
    [sendMessage, user, navigate]
  );

  // Strip :::PROFILE_JSON::: blocks from displayed messages
  const displayMessages = messages.map((m) => {
    if (m.role === "assistant" && m.content.includes(":::PROFILE_JSON:::")) {
      const [clean] = extractProfileJSON(m.content);
      return { ...m, content: clean };
    }
    return m;
  });

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden w-80 flex-col items-center justify-center border-r border-border bg-card p-8 lg:flex">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <h2 className="mb-2 text-xl font-bold">AI Sales Sync</h2>
        <p className="text-center text-sm text-muted-foreground">
          Your AI sales team is getting to know your business. Once complete, it will start finding clients, running multi-channel outreach, and building your deal pipeline.
        </p>

        <div className="mt-12 space-y-4 w-full">
          {[
            { label: "Business profile", done: messages.length > 2 },
            { label: "Target markets", done: messages.length > 6 },
            { label: "Differentiators", done: messages.length > 8 },
            { label: "Outreach style", done: messages.length > 10 },
            { label: "First campaign", done: messages.length > 12 },
          ].map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <div
                className={`h-2.5 w-2.5 rounded-full ${step.done ? "bg-success" : "bg-border"
                  }`}
              />
              <span
                className={`text-sm ${step.done ? "text-foreground" : "text-muted-foreground"
                  }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1">
        <ChatPanel
          messages={displayMessages}
          isLoading={isLoading}
          error={error}
          onSend={handleSend}
          onCancel={cancel}
          title="Onboarding"
          placeholder="Type your response..."
          quickReplies={quickReplies}
          onQuickReply={handleSend}
          fullScreen
        />
      </div>
    </div>
  );
};

export default Onboarding;
