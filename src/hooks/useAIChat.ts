import { useState, useRef, useCallback } from "react";
import { ChatMessage, ChatContext, streamChat } from "@/lib/ai-chat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface UseAIChatOptions {
  context: ChatContext;
  companyProfile?: Record<string, unknown> | null;
  initialMessages?: ChatMessage[];
}

export function useAIChat({ context, companyProfile, initialMessages = [] }: UseAIChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: "user", content: input.trim() };
      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setIsLoading(true);
      setError(null);

      // Save user message to DB
      if (user) {
        try {
          const { error: dbErr } = await supabase.from("chat_messages").insert({
            profile_id: user.id,
            role: "user",
            content: input.trim(),
            context,
          });
          if (dbErr) console.error("Failed to save user message:", dbErr.message);
        } catch (saveErr) {
          console.error("Failed to save user message:", saveErr);
        }
      }

      let assistantContent = "";
      const controller = new AbortController();
      abortRef.current = controller;

      const upsertAssistant = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { role: "assistant", content: assistantContent }];
        });
      };

      try {
        await streamChat({
          messages: updatedMessages,
          context,
          companyProfile,
          onDelta: upsertAssistant,
          onDone: async () => {
            setIsLoading(false);
            // Save assistant message to DB
            if (user && assistantContent) {
              try {
                const { error: dbErr } = await supabase.from("chat_messages").insert({
                  profile_id: user.id,
                  role: "assistant",
                  content: assistantContent,
                  context,
                });
                if (dbErr) console.error("Failed to save assistant message:", dbErr.message);
              } catch (saveErr) {
                console.error("Failed to save assistant message:", saveErr);
              }
            }
          },
          onError: (err) => {
            setError(err);
            setIsLoading(false);
          },
          signal: controller.signal,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
        }
        setIsLoading(false);
      }
    },
    [messages, isLoading, context, companyProfile, user]
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    setMessages(initialMessages);
    setError(null);
  }, [initialMessages]);

  return { messages, isLoading, error, sendMessage, cancel, reset };
}
