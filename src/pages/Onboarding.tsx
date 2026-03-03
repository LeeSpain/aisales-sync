import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import { supabase } from "@/integrations/supabase/client";
import ChatPanel from "@/components/chat/ChatPanel";
import { Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Onboarding = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [quickReplies, setQuickReplies] = useState<string[]>([]);

  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "onboarding",
    initialMessages: [
      {
        role: "assistant",
        content:
          "Welcome to Media Sync! 🚀 I'm your AI sales team. I'm going to learn everything about your business so I can start finding clients, running outreach, and building your pipeline.\n\nThis takes about 5 minutes. Let's start simple — **what's your company website?**",
      },
    ],
  });

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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden w-80 flex-col items-center justify-center border-r border-border bg-card p-8 lg:flex">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary">
          <Zap className="h-8 w-8 text-white" />
        </div>
        <h2 className="mb-2 text-xl font-bold">Media Sync</h2>
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
          messages={messages}
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
