import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { optionsResponse, jsonResponse, errorResponse, getSupabaseClient, checkDeadSwitch, checkRateLimit } from "../_shared/utils.ts";

// ─── Serper Google Search ───
async function serperSearch(
  apiKey: string,
  query: string,
  num = 10
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num }),
  });

  if (!res.ok) {
    console.error(`[discover] Serper returned ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data.organic as Array<Record<string, unknown>>) || [];
}

// ─── Serper Places (Google Maps) ───
async function serperPlaces(
  apiKey: string,
  query: string,
  location: string
): Promise<Array<Record<string, unknown>>> {
  const res = await fetch("https://google.serper.dev/places", {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, location, num: 20 }),
  });

  if (!res.ok) {
    console.error(`[discover] Serper places returned ${res.status}`);
    return [];
  }

  const data = await res.json();
  return (data.places as Array<Record<string, unknown>>) || [];
}

// ─── Extract domain from URL ───
function extractDomain(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

// ─── Build search queries from criteria ───
function buildQueries(
  targetCriteria: Record<string, unknown>,
  geographicFocus: string,
  companyProfile: Record<string, unknown> | null
): string[] {
  const industries = (targetCriteria.industries as string[]) || [];
  const roles = (targetCriteria.decision_maker_roles as string[]) || [];
  const companySize = (targetCriteria.company_size as string) || "";
  const targetMarkets = (companyProfile?.target_markets as string[]) || [];

  const queries: string[] = [];

  // Primary query: industry + location
  if (industries.length > 0) {
    queries.push(`${industries.join(" OR ")} ${geographicFocus}`);
  }

  // Target market specific queries
  for (const market of targetMarkets.slice(0, 2)) {
    queries.push(`${market} companies ${geographicFocus}`);
  }

  // Industry + size
  if (industries.length > 0 && companySize) {
    queries.push(`${industries[0]} ${companySize} business ${geographicFocus}`);
  }

  // Fallback generic
  if (queries.length === 0) {
    queries.push(`businesses ${geographicFocus}`);
  }

  return queries.slice(0, 4); // Max 4 queries
}

// ─── Parse Serper results into lead format ───
function parsePlaceToLead(place: Record<string, unknown>, industry: string, geo: string): Record<string, unknown> {
  const addressParts = ((place.address as string) || "").split(",").map((s: string) => s.trim());
  const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2] : geo;

  return {
    business_name: place.title || "Unknown",
    website: place.website || null,
    phone: place.phoneNumber || place.phone || null,
    address: place.address || null,
    city,
    country: addressParts[addressParts.length - 1] || null,
    industry,
    description: place.description || place.snippet || null,
    rating: place.rating || null,
    review_count: place.reviewsCount || place.reviews || null,
    size_estimate: "small",
    source: "google_maps",
  };
}

function parseSearchToLead(result: Record<string, unknown>, industry: string, geo: string): Record<string, unknown> {
  const domain = extractDomain(result.link as string);
  return {
    business_name: (result.title as string)?.replace(/ -.*$/, "").replace(/ \|.*$/, "").trim() || "Unknown",
    website: domain ? `https://${domain}` : null,
    city: geo,
    industry,
    description: result.snippet || null,
    source: "serper",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("discover-leads", 20, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    const sb = getSupabaseClient();
    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    const { campaignId, companyProfile, targetCriteria, geographicFocus } = await req.json();

    if (!campaignId || !targetCriteria || !geographicFocus) {
      return errorResponse("Missing required params: campaignId, targetCriteria, geographicFocus", 400);
    }

    // ── Get Serper API key ──
    let serperKey = Deno.env.get("SERPER_API_KEY") || null;
    if (!serperKey) {
      const { data: keyRow } = await sb
        .from("api_keys")
        .select("key_value")
        .eq("key_name", "serper_api_key")
        .maybeSingle();
      serperKey = keyRow?.key_value || null;
    }

    if (!serperKey || serperKey === "configured") {
      return errorResponse("Serper API key not configured. Add it in Settings > API Keys.", 400);
    }

    const industries = (targetCriteria.industries as string[]) || ["Business Services"];
    const primaryIndustry = industries[0] || "Business Services";

    // ── Run Google Maps Places search (best source for real businesses) ──
    const queries = buildQueries(targetCriteria, geographicFocus, companyProfile);
    const allLeads: Record<string, unknown>[] = [];
    const seenNames = new Set<string>();

    // Places search first (higher quality — real Google Maps data)
    for (const query of queries.slice(0, 2)) {
      const places = await serperPlaces(serperKey, query, geographicFocus);
      for (const place of places) {
        const name = (place.title as string || "").toLowerCase().trim();
        if (name && !seenNames.has(name)) {
          seenNames.add(name);
          allLeads.push(parsePlaceToLead(place, primaryIndustry, geographicFocus));
        }
      }
    }

    // Web search as supplement if places didn't return enough
    if (allLeads.length < 10) {
      for (const query of queries) {
        const results = await serperSearch(serperKey, query, 10);
        for (const result of results) {
          const name = ((result.title as string) || "").toLowerCase().replace(/ -.*$/, "").replace(/ \|.*$/, "").trim();
          if (name && !seenNames.has(name) && name.length > 3) {
            seenNames.add(name);
            allLeads.push(parseSearchToLead(result, primaryIndustry, geographicFocus));
          }
        }
        if (allLeads.length >= 20) break;
      }
    }

    if (allLeads.length === 0) {
      return errorResponse("No businesses found for the selected criteria. Try broader targeting or a different location.", 404);
    }

    console.log(`[discover] Found ${allLeads.length} real businesses for campaign ${campaignId}`);

    return jsonResponse({ leads: allLeads.slice(0, 25), count: Math.min(allLeads.length, 25), source: "google_maps" });
  } catch (e) {
    console.error("discover-leads error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
