import { useAuth } from "@/hooks/useAuth";
import { useAIChat } from "@/hooks/useAIChat";
import ChatPanel from "@/components/chat/ChatPanel";
import { Settings as SettingsIcon } from "lucide-react";

const SettingsPage = () => {
  const { messages, isLoading, error, sendMessage, cancel } = useAIChat({
    context: "settings",
    initialMessages: [
      {
        role: "assistant",
        content: "Welcome to settings! 🔧\n\nJust tell me what you'd like to change. I can update your:\n\n- **Company profile** — name, services, targets\n- **Tone preference** — formal, professional, casual, friendly\n- **Autonomy level** — how much freedom the AI has\n- **Geographic range** — where to find leads\n\nWhat would you like to adjust?",
      },
    ],
  });

  return (
    <div className="flex h-[calc(100vh)]">
      <div className="hidden w-72 flex-col border-r border-border bg-card p-8 lg:flex">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <SettingsIcon className="h-7 w-7 text-primary" />
        </div>
        <h2 className="mb-2 text-lg font-bold">Settings</h2>
        <p className="text-sm text-muted-foreground">
          Talk to the AI to make changes. No forms needed — just describe what you want to update.
        </p>
      </div>
      <div className="flex-1">
        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          error={error}
          onSend={sendMessage}
          onCancel={cancel}
          title="Settings"
          placeholder="What would you like to change?"
          fullScreen
        />
      </div>
    </div>
  );
};

export default SettingsPage;
