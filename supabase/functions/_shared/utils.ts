import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

export function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// deno-lint-ignore no-explicit-any
export async function checkDeadSwitch(sb: any) {
  const { data: deadSwitch } = await sb
    .from("ai_config")
    .select("is_active")
    .eq("provider", "dead_switch")
    .eq("purpose", "system_setting")
    .maybeSingle();
  return deadSwitch?.is_active === true;
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(), "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ error: message }, status);
}

export function optionsResponse() {
  return new Response(null, { headers: getCorsHeaders() });
}

export async function callAI(options: {
  systemPrompt: string;
  userContent: string;
  tools?: unknown[];
  toolChoice?: unknown;
}) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: options.systemPrompt },
      { role: "user", content: options.userContent },
    ],
  };

  if (options.tools) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice;
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error("Rate limit exceeded. Please try again in a moment.");
    }
    if (response.status === 402) {
      throw new Error("AI usage limit reached. Please add credits.");
    }
    const text = await response.text();
    console.error("AI gateway error:", response.status, text);
    throw new Error("AI service temporarily unavailable");
  }

  return response.json();
}

export function extractToolCallArgs(data: Record<string, unknown>): Record<string, unknown> | null {
  const choices = data.choices as Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  const toolCall = choices?.[0]?.message?.tool_calls?.[0];
  if (toolCall?.function?.arguments) {
    return JSON.parse(toolCall.function.arguments);
  }
  return null;
}

// deno-lint-ignore no-explicit-any
export async function logActivity(
  sb: any,
  action: string,
  companyId: string | null,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await sb.from("activity_log").insert({
    action,
    company_id: companyId,
    description,
    metadata: metadata || null,
  });
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}
