import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { supabase } from "@/integrations/supabase/client";
import ChatPanel from "@/components/chat/ChatPanel";
import { useToast } from "@/hooks/use-toast";
import { Zap, Target } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const CampaignNew = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
        content: "Let's set up a new campaign! 🎯\n\nTell me — **who do you want to target?** What type of businesses or clients are you looking for? I'll help you define the perfect criteria.",
      },
    ],
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
          The AI will help you define targets, criteria, and launch your lead discovery campaign.
        </p>
        <div className="space-y-4">
          {["Target audience", "Geographic focus", "Quality criteria", "Campaign name", "Launch"].map((step, i) => (
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
          messages={messages}
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
