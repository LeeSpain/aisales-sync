const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatContext =
  | "onboarding"
  | "campaign_setup"
  | "outreach_review"
  | "reply_management"
  | "call_review"
  | "dashboard"
  | "settings"
  | "general";

interface StreamChatOptions {
  messages: ChatMessage[];
  context?: ChatContext;
  companyProfile?: Record<string, unknown> | null;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

export async function streamChat({
  messages,
  context = "general",
  companyProfile,
  onDelta,
  onDone,
  onError,
  signal,
}: StreamChatOptions) {
  const resp = await fetch(AI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, context, companyProfile }),
    signal,
  });

  if (!resp.ok) {
    const errorData = await resp.json().catch(() => ({ error: "Unknown error" }));
    const errorMsg = errorData.error || `Error ${resp.status}`;
    onError?.(errorMsg);
    return;
  }

  if (!resp.body) {
    onError?.("No response body");
    return;
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        /* ignore partial leftovers */
      }
    }
  }

  onDone();
}
