import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportEvent, updateDailyMetrics } from "@/lib/syncHub";

export type PipelineStage =
  | "idle"
  | "discovering"
  | "researching"
  | "scoring"
  | "saving_leads"
  | "decision_makers"
  | "generating_outreach"
  | "done"
  | "error";

interface PipelineState {
  stage: PipelineStage;
  progress: string;
  leadsFound: number;
  leadsQualified: number;
  messagesGenerated: number;
  error: string | null;
}

interface RunPipelineParams {
  campaignId: string;
  companyId: string;
  targetCriteria: Record<string, unknown>;
  geographicFocus: string;
  minimumScore: number;
  tone: string;
}

interface SerperPlace {
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  ratingCount?: number;
  category?: string;
  latitude?: number;
  longitude?: number;
}

interface SerperSearchResult {
  title?: string;
  link?: string;
  snippet?: string;
}

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────

const INDUSTRY_TO_SEARCH_TERM: Record<string, string> = {
  "Real Estate": "inmobiliaria agencia inmobiliaria estate agents property",
  "E-commerce": "tienda online ecommerce online store",
  "SaaS": "empresa software tech startup software company",
  "Retail": "tienda retail shop store comercio",
  "Healthcare": "clinica medica healthcare clinic medical centre",
  "Finance": "asesoría financiera financial services accountant",
  "Marketing": "agencia marketing digital marketing agency",
  "Hospitality": "hotel restaurante restaurant hospitality",
  "Manufacturing": "fabricacion manufacturing factory",
  "Education": "academia escuela school college training",
  "Professional Services": "asesoría consultoria consultancy professional services",
};

const INDUSTRY_FALLBACK_TERM: Record<string, string> = {
  "Real Estate": "inmobiliaria",
  "Finance": "asesoría financiera",
  "Marketing": "agencia marketing",
  "Healthcare": "clinica",
  "Education": "academia",
  "Professional Services": "consultoria",
  "Hospitality": "hotel",
  "Manufacturing": "empresa industrial",
  "SaaS": "empresa tecnologia",
  "Retail": "tienda comercio",
  "E-commerce": "tienda online",
};

const COUNTRY_TO_GL: Record<string, string> = {
  "Spain": "es", "United Kingdom": "gb", "United States": "us",
  "Canada": "ca", "Australia": "au", "Germany": "de",
  "France": "fr", "Italy": "it", "Netherlands": "nl",
  "Ireland": "ie", "Sweden": "se", "Norway": "no",
  "Denmark": "dk", "Switzerland": "ch", "Belgium": "be",
  "Austria": "at", "Portugal": "pt", "New Zealand": "nz",
  "Singapore": "sg", "UAE": "ae", "India": "in",
  "Brazil": "br", "Mexico": "mx",
};

const INDUSTRY_ALLOW_TERMS: Record<string, string[]> = {
  "Real Estate": ["estate", "property", "letting", "realt", "homes", "housing", "land agent",
    "inmobiliaria", "agencia inmobiliaria", "compraven", "alquiler"],
  "Finance": ["financial", "accountant", "accounting", "bank", "insurance",
    "mortgage", "investment", "wealth", "tax", "contabilidad", "asesoría fiscal"],
  "Marketing": ["marketing", "agency", "advertising", "digital", "media",
    "seo", "brand", "creative", "publicidad"],
  "Healthcare": ["clinic", "health", "medical", "dental", "therapy", "physio",
    "care", "pharmacy", "doctor", "clínica", "salud"],
  "Education": ["school", "college", "academy", "training", "language",
    "tutoring", "university", "escuela", "academia"],
  "Professional Services": ["consultant", "consultancy", "solicitor", "lawyer",
    "architect", "engineer", "surveyor", "advisor", "asesor"],
  "Hospitality": ["hotel", "restaurant", "bar", "café", "bistro",
    "resort", "spa", "catering", "hostal"],
  "Manufacturing": ["manufactur", "factory", "production", "industrial",
    "warehouse", "fabricat", "fábrica"],
  "SaaS": ["software", "tech", "saas", "app", "platform", "cloud",
    "development", "digital"],
  "E-commerce": ["online store", "ecommerce", "shop", "boutique", "retail",
    "tienda", "store"],
};

const KNOWN_BAD_CHAINS = [
  "alcampo", "mercadona", "lidl", "aldi", "carrefour", "eroski",
  "tesco", "sainsbury", "asda", "morrisons", "waitrose", "iceland",
  "dunnes", "supervalu", "costco", "walmart", "amazon",
  "mcdonald", "burger king", "kfc", "subway", "starbucks",
  "repsol", "cepsa", "bp ", "shell ",
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function isRelevantPlace(place: SerperPlace, requestedIndustries: string[]): boolean {
  const cat = (place.category || "").toLowerCase();
  const title = (place.title || "").toLowerCase();
  const combined = `${cat} ${title}`;

  if (KNOWN_BAD_CHAINS.some((chain) => combined.includes(chain))) return false;

  const rejectCategories = [
    "supermarket", "grocery", "convenience store", "hypermarket",
    "petrol station", "gas station", "fuel station",
    "fast food", "takeaway", "church", "mosque", "temple",
    "hospital", "atm", "cash machine",
  ];
  if (rejectCategories.some((term) => combined.includes(term))) return false;

  if (!requestedIndustries.length) return true;

  for (const industry of requestedIndustries) {
    const allowTerms = INDUSTRY_ALLOW_TERMS[industry];
    if (!allowTerms) continue;
    if (allowTerms.some((t) => combined.includes(t))) return true;
  }

  if (!place.category) return true;
  return false;
}

async function serperFetch(
  endpoint: string,
  query: string,
  apiKey: string,
  gl = "us",
  num = 10
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://google.serper.dev/${endpoint}`, {
    method: "POST",
    headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, gl, hl: "en", num }),
  });
  if (!res.ok) throw new Error(`Serper error ${res.status} on ${endpoint}`);
  return res.json();
}

// ─────────────────────────────────────────────
// STAGE 1: DISCOVER real businesses via Google Places
// ─────────────────────────────────────────────

async function discoverLeads(
  serperKey: string,
  targetCriteria: Record<string, unknown>,
  geographicFocus: string
): Promise<SerperPlace[]> {
  const industries = (targetCriteria.industries as string[]) || [];
  const keywords = (targetCriteria.keywords as string[]) || [];
  const cities = (targetCriteria.geo_cities as string[]) || [];
  const regions = (targetCriteria.geo_regions as string[]) || [];
  const countries = (targetCriteria.geo_countries as string[]) || [];

  const searchTerms = industries.map((ind) => INDUSTRY_TO_SEARCH_TERM[ind] || ind).join(" ");
  const keywordStr = keywords.length > 0 ? ` ${keywords.join(" ")}` : "";
  const gl = COUNTRY_TO_GL[countries[0]] || "us";

  const locations: string[] = [];
  if (cities.length > 0) locations.push(...cities.slice(0, 5));
  else if (regions.length > 0) locations.push(...regions.slice(0, 3));
  else if (countries.length > 0) locations.push(...countries.slice(0, 2));
  else locations.push(geographicFocus);

  const allPlaces: SerperPlace[] = [];

  for (const location of locations) {
    const query = `${searchTerms}${keywordStr} in ${location}`;
    console.log(`[discover] Query: "${query}" (gl=${gl})`);

    let places: SerperPlace[] = [];
    try {
      const data = await serperFetch("places", query, serperKey, gl, 20);
      places = (data.places as SerperPlace[]) || [];
    } catch (err) {
      console.error(`[discover] Failed for ${location}:`, err);
    }

    // Fallback query if no results
    if (places.length === 0 && industries.length > 0) {
      const fallback = INDUSTRY_FALLBACK_TERM[industries[0]] || industries[0];
      const fbQuery = `${fallback} in ${location}`;
      console.log(`[discover] Fallback: "${fbQuery}"`);
      try {
        const fbData = await serperFetch("places", fbQuery, serperKey, gl, 20);
        places = (fbData.places as SerperPlace[]) || [];
      } catch (e) { console.error("[discover] Fallback failed:", e); }
    }

    const relevant = places.filter((p) => isRelevantPlace(p, industries));
    // Safety net: if filter too strict, use minus-bad-chains only
    if (places.length > 0 && relevant.length === 0) {
      const relaxed = places.filter((p) => {
        const combined = `${(p.category || "").toLowerCase()} ${(p.title || "").toLowerCase()}`;
        return !KNOWN_BAD_CHAINS.some((c) => combined.includes(c));
      });
      allPlaces.push(...relaxed);
    } else {
      allPlaces.push(...relevant);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return allPlaces.filter((p) => {
    const key = (p.title || "").toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────
// STAGE 2: RESEARCH each business via Serper web search + website visit
// ─────────────────────────────────────────────

interface WebResearch {
  description: string;
  services: string[];
  contact_clues: string;
  snippets: string[];
}

async function researchBusiness(
  serperKey: string,
  businessName: string,
  website: string | null | undefined,
  location: string,
  gl: string
): Promise<WebResearch> {
  const queries: string[] = [];

  // Query 1: business name + location
  queries.push(`"${businessName}" ${location}`);

  // Query 2: scrape their website if available
  if (website) {
    const domain = website.replace(/^https?:\/\//i, "").split("/")[0];
    queries.push(`site:${domain}`);
  }

  const results: SerperSearchResult[] = [];
  for (const q of queries) {
    try {
      const data = await serperFetch("search", q, serperKey, gl, 5);
      const organic = (data.organic as SerperSearchResult[]) || [];
      results.push(...organic.slice(0, 3));
    } catch (e) {
      console.error(`[research] Serper search failed for "${q}":`, e);
    }
  }

  const snippets = results.map((r) =>
    `${r.title || ""}: ${r.snippet || ""}`.trim()
  ).filter(Boolean);

  const description = snippets[0] || `Business in ${location}`;
  const services = snippets.slice(0, 3);
  const contact_clues = results
    .map((r) => r.snippet || "")
    .join(" ")
    .match(/\b\+?[\d\s\-\(\)]{7,}\b/g)?.[0] || "";

  return { description, services, contact_clues, snippets };
}

// ─────────────────────────────────────────────
// STAGE 4: RESEARCH decision makers for qualified leads
// ─────────────────────────────────────────────

interface DecisionMaker {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  source: string;
}

async function findDecisionMaker(
  serperKey: string,
  businessName: string,
  location: string,
  targetRole: string,
  gl: string
): Promise<DecisionMaker> {
  const roleTerms = targetRole === "Any decision maker"
    ? "owner director manager CEO"
    : targetRole;

  const query = `"${businessName}" ${location} ${roleTerms} contact`;
  console.log(`[decision-maker] Searching: "${query}"`);

  try {
    const data = await serperFetch("search", query, serperKey, gl, 5);
    const organic = (data.organic as SerperSearchResult[]) || [];
    const allText = organic.map((r) => `${r.title} ${r.snippet}`).join(" ");

    // Extract email pattern
    const emailMatch = allText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    // Extract phone pattern
    const phoneMatch = allText.match(/\b\+?[\d\s\-\(\)]{7,15}\b/);
    // Extract LinkedIn
    const linkedinResult = organic.find((r) => r.link?.includes("linkedin.com"));

    // Try to find a name from snippets
    const nameMatch = allText.match(/(?:by|from|contact|team|meet)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/);

    return {
      name: nameMatch?.[1] || null,
      role: targetRole !== "Any decision maker" ? targetRole : null,
      email: emailMatch?.[0] || null,
      phone: phoneMatch?.[0] || null,
      linkedin: linkedinResult?.link || null,
      source: organic.length > 0 ? "serper_web_search" : "not_found",
    };
  } catch (e) {
    console.error("[decision-maker] Research failed:", e);
    return { name: null, role: null, email: null, phone: null, linkedin: null, source: "error" };
  }
}

// ─────────────────────────────────────────────
// MAP Serper places → lead format
// ─────────────────────────────────────────────

function mapPlaceToLead(
  place: SerperPlace,
  research: WebResearch,
  targetCriteria: Record<string, unknown>,
  geographicFocus: string
): Record<string, unknown> {
  const reviewCount = place.ratingCount || 0;
  let sizeEstimate: "small" | "medium" | "large" | "enterprise" = "small";
  if (reviewCount > 500) sizeEstimate = "enterprise";
  else if (reviewCount > 100) sizeEstimate = "large";
  else if (reviewCount > 20) sizeEstimate = "medium";

  const addressParts = (place.address || "").split(",");
  const city = addressParts.length > 1
    ? addressParts[addressParts.length - 2]?.trim()
    : geographicFocus;

  const inferredIndustry =
    (targetCriteria.industries as string[])?.[0] ||
    place.category ||
    "Business Services";

  const description = research.description.length > 10
    ? research.description
    : place.category
      ? `${place.category} located at ${place.address || geographicFocus}`
      : `Business in ${geographicFocus}`;

  return {
    business_name: place.title || "Unknown Business",
    website: place.website || null,
    email: null,
    phone: place.phone || null,
    address: place.address || null,
    city: city || geographicFocus,
    region: addressParts[addressParts.length - 1]?.trim() || null,
    country: (targetCriteria.geo_countries as string[])?.[0] || null,
    industry: place.category || inferredIndustry,
    description,
    rating: place.rating || null,
    review_count: reviewCount || null,
    size_estimate: sizeEstimate,
    contact_name: null,
    contact_role: null,
    contact_email: null,
    _research: research,
  };
}

// ─────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────

export function useCampaignPipeline() {
  const [state, setState] = useState<PipelineState>({
    stage: "idle",
    progress: "",
    leadsFound: 0,
    leadsQualified: 0,
    messagesGenerated: 0,
    error: null,
  });
  const isRunningRef = useRef(false);

  const runPipeline = useCallback(async (params: RunPipelineParams) => {
    const { campaignId, companyId, targetCriteria, geographicFocus, minimumScore, tone } = params;

    if (isRunningRef.current) return;
    isRunningRef.current = true;

    try {
      // ────── Step 1: Fetch company profile ──────
      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      const companyProfile = companyData
        ? {
          name: companyData.name,
          industry: companyData.industry,
          services: companyData.services,
          target_markets: companyData.target_markets,
          unique_selling_points: companyData.selling_points,
        }
        : { name: "Company" };

      // ────── Step 2: Read Serper API key ──────
      setState((s) => ({ ...s, stage: "discovering", progress: "Loading Serper API key..." }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: keyRow } = await (supabase as any)
        .from("api_keys")
        .select("key_value")
        .eq("key_name", "SERPER_API_KEY")
        .eq("is_active", true)
        .maybeSingle();

      const serperKey = keyRow?.key_value as string | undefined;
      if (!serperKey) {
        throw new Error(
          "Serper API key not configured. Go to Admin → Settings → Lead Discovery and save your SERPER_API_KEY."
        );
      }

      const gl = COUNTRY_TO_GL[(targetCriteria.geo_countries as string[])?.[0]] || "us";
      const targetRole = (targetCriteria.target_decision_maker as string) || "Any decision maker";

      // ────── STAGE 1: DISCOVER ──────
      setState((s) => ({ ...s, stage: "discovering", progress: "🔍 Searching Google for real businesses..." }));
      await supabase.from("campaigns").update({ status: "hunting" }).eq("id", campaignId);

      const places = await discoverLeads(serperKey, targetCriteria, geographicFocus);
      if (places.length === 0) {
        throw new Error("No businesses found on Google Places. Try broadening your industry or location.");
      }

      setState((s) => ({
        ...s,
        leadsFound: places.length,
        progress: `✅ Found ${places.length} real businesses on Google. Now researching each one...`,
      }));

      // ────── STAGE 2: RESEARCH each business website ──────
      setState((s) => ({ ...s, stage: "researching" }));

      const enrichedLeads: Array<Record<string, unknown>> = [];

      for (let i = 0; i < places.length; i++) {
        const place = places[i];
        setState((s) => ({
          ...s,
          progress: `🌐 Researching ${i + 1}/${places.length}: ${place.title}...`,
        }));

        const research = await researchBusiness(
          serperKey,
          place.title || "",
          place.website,
          geographicFocus,
          gl
        );

        enrichedLeads.push(mapPlaceToLead(place, research, targetCriteria, geographicFocus));
      }

      // ────── STAGE 3: SCORE each lead 1-5 ──────
      setState((s) => ({ ...s, stage: "scoring" }));
      await supabase.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

      const scoredLeads: Array<
        Record<string, unknown> & { _score: number; _reasoning: string; _qualified: boolean }
      > = [];

      for (let i = 0; i < enrichedLeads.length; i++) {
        const lead = enrichedLeads[i];
        setState((s) => ({
          ...s,
          progress: `⭐ Scoring ${i + 1}/${enrichedLeads.length}: ${String(lead.business_name)} (1-5 fit score)...`,
        }));

        // Pass research snippets to the scorer for better context
        const { _research, ...leadWithoutResearch } = lead as Record<string, unknown> & { _research: WebResearch };
        const leadForScoring = {
          ...leadWithoutResearch,
          description: String(lead.description),
          research_snippets: _research?.snippets || [],
        };

        const { data: scoreData, error: scoreErr } = await supabase.functions.invoke("score-lead", {
          body: { lead: leadForScoring, companyProfile },
        });

        const score = scoreErr ? 3.0 : (scoreData?.score ?? 3.0);
        const reasoning = scoreErr ? "Scoring unavailable" : (scoreData?.reasoning ?? "");
        const qualified = score >= minimumScore;

        scoredLeads.push({ ...lead, _score: score, _reasoning: reasoning, _qualified: qualified });
      }

      const qualifiedLeads = scoredLeads.filter((l) => l._qualified);
      setState((s) => ({
        ...s,
        leadsQualified: qualifiedLeads.length,
        progress: `✅ ${qualifiedLeads.length} of ${scoredLeads.length} leads scored ${minimumScore}+. Saving to database...`,
      }));

      // ────── STAGE 3b: SAVE leads to DB ──────
      setState((s) => ({ ...s, stage: "saving_leads" }));

      const leadsToInsert = scoredLeads.map((l) => ({
        campaign_id: campaignId,
        company_id: companyId,
        business_name: (l.business_name as string) || "Unknown",
        website: (l.website as string) || null,
        email: null,
        phone: (l.phone as string) || null,
        address: (l.address as string) || null,
        city: (l.city as string) || null,
        region: (l.region as string) || null,
        country: (l.country as string) || null,
        industry: (l.industry as string) || null,
        description: (l.description as string) || null,
        rating: (l.rating as number) || null,
        review_count: (l.review_count as number) || null,
        size_estimate: (l.size_estimate as string) || null,
        contact_name: null,
        contact_role: null,
        contact_email: null,
        score: l._score,
        score_reasoning: l._reasoning,
        status: l._qualified ? "qualified" : "scored",
        source: "google_maps",
      }));

      const { data: insertedLeads, error: insertErr } = await supabase
        .from("leads")
        .insert(leadsToInsert)
        .select("id, score, status, business_name, contact_name, contact_email, city, industry, description, website");

      if (insertErr) throw new Error(`Failed to save leads: ${insertErr.message}`);

      // Sync Hub events
      if (insertedLeads && insertedLeads.length > 0) {
        let count = 0;
        for (const lead of insertedLeads) {
          if (lead.status === "qualified") {
            await reportEvent("new_lead", {
              label: `New lead — Google Places`,
              metadata: { source: "google_maps", business: lead.business_name },
            });
            count++;
          }
        }
        if (count > 0) await updateDailyMetrics({ newLeads: count });
      }

      await supabase.from("campaigns").update({
        leads_found: scoredLeads.length,
        leads_qualified: qualifiedLeads.length,
        status: "outreach",
      }).eq("id", campaignId);

      // ────── STAGE 4: RESEARCH decision makers for qualified leads ──────
      const qualifiedInserted = insertedLeads?.filter((l) => l.status === "qualified") || [];

      if (qualifiedInserted.length > 0) {
        setState((s) => ({
          ...s,
          stage: "decision_makers",
          progress: `🕵️ Finding decision makers for ${qualifiedInserted.length} qualified leads...`,
        }));

        for (let i = 0; i < qualifiedInserted.length; i++) {
          const lead = qualifiedInserted[i];
          setState((s) => ({
            ...s,
            progress: `🕵️ Researching ${i + 1}/${qualifiedInserted.length}: ${lead.business_name}...`,
          }));

          // First try the edge function (it has full AI + Serper)
          const { error: resErr } = await supabase.functions.invoke("research-lead", {
            body: { lead_id: lead.id },
          });

          // If edge function fails, do basic decision maker search directly
          if (resErr) {
            console.warn(`[pipeline] research-lead edge fn failed for ${lead.id}, doing direct search`);
            const dm = await findDecisionMaker(
              serperKey,
              lead.business_name,
              lead.city || geographicFocus,
              targetRole,
              gl
            );

            if (dm.name || dm.email || dm.phone) {
              await supabase.from("leads").update({
                contact_name: dm.name,
                contact_role: dm.role,
                contact_email: dm.email,
                contact_phone: dm.phone,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                research_data: { decision_maker: dm, source: "serper_web_search" } as any,
              }).eq("id", lead.id);
            }
          }
        }
      }

      // ────── STAGE 5: GENERATE outreach for qualified leads ──────
      if (qualifiedInserted.length > 0) {
        setState((s) => ({
          ...s,
          stage: "generating_outreach",
          progress: `✉️ Generating personalised outreach for ${qualifiedInserted.length} leads...`,
        }));

        let messagesGenerated = 0;

        for (let i = 0; i < qualifiedInserted.length; i++) {
          const lead = qualifiedInserted[i];
          setState((s) => ({
            ...s,
            progress: `✉️ Writing outreach ${i + 1}/${qualifiedInserted.length}: ${lead.business_name}...`,
          }));

          const { data: emailData, error: emailErr } = await supabase.functions.invoke("generate-outreach", {
            body: { lead, companyProfile, tone },
          });

          if (emailErr || !emailData?.subject) continue;

          const { error: msgErr } = await supabase.from("outreach_messages").insert({
            campaign_id: campaignId,
            company_id: companyId,
            lead_id: lead.id,
            subject: emailData.subject,
            body: emailData.body,
            channel: "email",
            email_type: "outreach",
            status: "pending_approval",
            ai_model_used: "gemini-flash",
          });

          if (!msgErr) messagesGenerated++;
        }

        await supabase.from("campaigns").update({ emails_sent: messagesGenerated }).eq("id", campaignId);

        setState((s) => ({
          ...s,
          messagesGenerated,
          progress: `✅ Done! ${scoredLeads.length} businesses found, ${qualifiedLeads.length} qualified, ${messagesGenerated} outreach emails drafted.`,
        }));
      }

      // ────── Finalize ──────
      await supabase.from("campaigns").update({ status: "active" }).eq("id", campaignId);

      setState((s) => ({
        ...s,
        stage: "done",
        progress: `🎯 Campaign complete! ${scoredLeads.length} real businesses discovered, ${qualifiedLeads.length} qualified (score ≥${minimumScore}), ${s.messagesGenerated} outreach drafts ready.`,
      }));

    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed";
      console.error("Campaign pipeline error:", err);
      await supabase.from("campaigns").update({ status: "setup" }).eq("id", campaignId);
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  return { ...state, runPipeline };
}
