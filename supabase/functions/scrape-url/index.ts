// URL scraper endpoint
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  checkRateLimit,
  optionsResponse,
  jsonResponse,
  errorResponse,
} from "../_shared/utils.ts";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type ScrapeHint = "static" | "js_heavy" | "deep_crawl" | "ai_extract";

interface ScrapeResult {
  url: string;
  provider_used: string;
  title: string;
  description: string;
  main_content: string;
  emails_found: string[];
  phones_found: string[];
  links_found: string[];
  extraction_quality: "low" | "medium" | "high";
  fetched_at: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER INTERFACE — each provider implements this signature
// ─────────────────────────────────────────────────────────────────────────────

type ScrapeProvider = (url: string) => Promise<ScrapeResult>;

function makeEmptyResult(url: string, provider: string, error: string): ScrapeResult {
  return {
    url,
    provider_used: provider,
    title: "",
    description: "",
    main_content: "",
    emails_found: [],
    phones_found: [],
    links_found: [],
    extraction_quality: "low",
    fetched_at: new Date().toISOString(),
    error,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER: static (fetch + parse HTML)
// ─────────────────────────────────────────────────────────────────────────────

const staticProvider: ScrapeProvider = async (url: string) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AISalesBot/1.0; +https://aisales-sync.com)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });

    if (!res.ok) {
      return makeEmptyResult(url, "static", `HTTP ${res.status}`);
    }

    const html = await res.text();
    const fetchedAt = new Date().toISOString();

    // Extract <title>
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : "";

    // Extract meta description
    const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : "";

    // Strip tags for main content extraction
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : html;

    // Remove script, style, nav, header, footer tags
    const cleaned = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<header[\s\S]*?<\/header>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    // Cap main content at 10KB
    const mainContent = cleaned.slice(0, 10_000);

    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailsRaw = html.match(emailRegex) || [];
    const emails = [...new Set(emailsRaw)]
      .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".gif"))
      .slice(0, 20);

    // Extract phone numbers (international-ish)
    const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/g;
    const phonesRaw = html.match(phoneRegex) || [];
    const phones = [...new Set(phonesRaw.map((p) => p.trim()))]
      .filter((p) => p.replace(/\D/g, "").length >= 7)
      .slice(0, 10);

    // Extract links (href values)
    const linkRegex = /href=["'](https?:\/\/[^"'\s>]+)["']/gi;
    const links: string[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null && links.length < 50) {
      links.push(linkMatch[1]);
    }

    // Quality heuristic
    let quality: "low" | "medium" | "high" = "low";
    if (mainContent.length > 500 && title) quality = "medium";
    if (mainContent.length > 2000 && title && description) quality = "high";

    return {
      url,
      provider_used: "static",
      title,
      description,
      main_content: mainContent,
      emails_found: emails,
      phones_found: phones,
      links_found: [...new Set(links)],
      extraction_quality: quality,
      fetched_at: fetchedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Fetch failed";
    return makeEmptyResult(url, "static", msg.includes("abort") ? "Timeout (15s)" : msg);
  } finally {
    clearTimeout(timeout);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER STUBS — return "not configured" errors
// ─────────────────────────────────────────────────────────────────────────────

const playwrightProvider: ScrapeProvider = async (url: string) =>
  makeEmptyResult(url, "playwright", "playwright_not_configured");

const crawl4aiProvider: ScrapeProvider = async (url: string) =>
  makeEmptyResult(url, "crawl4ai", "crawl4ai_not_configured");

const scrapyProvider: ScrapeProvider = async (url: string) =>
  makeEmptyResult(url, "scrapy", "scrapy_not_configured");

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER ROUTER
// ─────────────────────────────────────────────────────────────────────────────

const HINT_TO_PROVIDER: Record<ScrapeHint, string> = {
  static: "static",
  js_heavy: "playwright",
  deep_crawl: "scrapy",
  ai_extract: "crawl4ai",
};

const PROVIDERS: Record<string, ScrapeProvider> = {
  static: staticProvider,
  playwright: playwrightProvider,
  crawl4ai: crawl4aiProvider,
  scrapy: scrapyProvider,
};

async function resolveProvider(
  sb: ReturnType<typeof getSupabaseClient>,
  hint?: ScrapeHint
): Promise<ScrapeProvider> {
  const preferredName = hint ? HINT_TO_PROVIDER[hint] : "static";

  // If not static, check if the provider is actually enabled
  if (preferredName !== "static") {
    const { data: config } = await sb
      .from("provider_configs")
      .select("is_enabled")
      .eq("provider_name", preferredName)
      .is("company_id", null)
      .maybeSingle();

    if (!config?.is_enabled) {
      // Fall back to static if the preferred provider isn't enabled
      console.log(`[scrape-url] ${preferredName} not enabled, falling back to static`);
      return staticProvider;
    }
  }

  return PROVIDERS[preferredName] || staticProvider;
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLER
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("scrape-url", 60, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();

    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const { url, hint } = body;

    if (!url || typeof url !== "string") {
      return errorResponse("Missing required param: url", 400);
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return errorResponse("Invalid URL format", 400);
    }

    const validHints: ScrapeHint[] = ["static", "js_heavy", "deep_crawl", "ai_extract"];
    const resolvedHint: ScrapeHint | undefined = hint && validHints.includes(hint) ? hint : undefined;

    const provider = await resolveProvider(sb, resolvedHint);
    const result = await provider(url);

    return jsonResponse(result);
  } catch (e) {
    console.error("scrape-url error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
