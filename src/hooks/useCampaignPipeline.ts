import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportEvent, updateDailyMetrics } from "@/lib/syncHub";

export type PipelineStage =
  | "idle"
  | "discovering"
  | "scoring"
  | "saving_leads"
  | "generating_outreach"
  | "finalizing"
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

// Maps campaign industry tags to precise Google Places search terms
const INDUSTRY_TO_SEARCH_TERM: Record<string, string> = {
  "Real Estate": "estate agents",
  "E-commerce": "ecommerce online store",
  "SaaS": "software company tech startup",
  "Retail": "retail shop store",
  "Healthcare": "healthcare clinic medical practice",
  "Finance": "financial services accountant",
  "Marketing": "marketing agency digital agency",
  "Hospitality": "hotel restaurant hospitality",
  "Manufacturing": "manufacturing factory",
  "Education": "school college training centre",
  "Professional Services": "professional services consultancy",
};

// Map country names to Serper gl country codes
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

// Industry-specific allow-terms: a result must contain at least one of these to pass
const INDUSTRY_ALLOW_TERMS: Record<string, string[]> = {
  "Real Estate": ["estate", "property", "letting", "realt", "homes", "housing", "land agent",
    "inmobiliaria", "agencia inmobiliaria", "compraven", "alquiler"],
  "Finance": ["financial", "accountant", "accounting", "bank", "insurance",
    "mortgage", "investment", "wealth", "tax", "contabilidad", "asesoría fiscal"],
  "Marketing": ["marketing", "agency", "advertising", "digital", "media",
    "seo", "brand", "creative", "pr ", "publicidad"],
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
  "SaaS": ["software", "tech", "saas", "app", "platform", "cloud", "it ",
    "development", "digital"],
  "E-commerce": ["online store", "ecommerce", "shop", "boutique", "retail",
    "tienda", "store"],
};

// Names of known supermarket & irrelevant chains to hard-reject
const KNOWN_BAD_CHAINS = [
  "alcampo", "mercadona", "lidl", "aldi", "carrefour", "eroski",
  "tesco", "sainsbury", "asda", "morrisons", "waitrose", "iceland",
  "dunnes", "supervalu", "costco", "walmart", "amazon",
  "mcdonald", "burger king", "kfc", "subway", "starbucks",
  "repsol", "cepsa", "bp ", "shell ",
];

// Reject results that clearly don't match the requested industries
function isRelevantPlace(place: SerperPlace, requestedIndustries: string[]): boolean {
  const cat = (place.category || "").toLowerCase();
  const title = (place.title || "").toLowerCase();
  const combined = `${cat} ${title}`;

  // Always reject known bad chains regardless of category
  if (KNOWN_BAD_CHAINS.some((chain) => combined.includes(chain))) return false;

  // Always reject generic bad categories
  const rejectCategories = [
    "supermarket", "grocery", "convenience store", "hypermarket",
    "petrol station", "gas station", "fuel station",
    "fast food", "takeaway", "church", "mosque", "temple",
    "hospital", "atm", "cash machine",
  ];
  if (rejectCategories.some((term) => combined.includes(term))) return false;

  // If no industries specified, accept everything that passed the reject filter
  if (!requestedIndustries.length) return true;

  // Check against industry-specific allow terms
  for (const industry of requestedIndustries) {
    const allowTerms = INDUSTRY_ALLOW_TERMS[industry];
    if (!allowTerms) continue; // unknown industry — let it through
    if (allowTerms.some((t) => combined.includes(t))) return true;
  }

  // If category data is absent, err on the side of inclusion
  if (!place.category) return true;

  return false; // doesn't match any requested industry
}

// ── Fetch real businesses from Google Places via Serper API ──
async function fetchRealLeadsFromSerper(
  serperKey: string,
  targetCriteria: Record<string, unknown>,
  geographicFocus: string
): Promise<SerperPlace[]> {
  // Build a PRECISE search term from industry only
  const industries = (targetCriteria.industries as string[]) || [];
  const keywords = (targetCriteria.keywords as string[]) || [];
  
  // Get precise search terms for each selected industry
  const searchTerms = industries.map((ind) => INDUSTRY_TO_SEARCH_TERM[ind] || ind).join(" OR ");
  const keywordStr = keywords.length > 0 ? ` ${keywords.join(" ")}` : "";
  
  // Determine search locations — prefer specific cities over vague country-level geographic focus
  const cities = (targetCriteria.geo_cities as string[]) || [];
  const regions = (targetCriteria.geo_regions as string[]) || [];
  const countries = (targetCriteria.geo_countries as string[]) || [];
  
  const locations: string[] = [];
  if (cities.length > 0) locations.push(...cities.slice(0, 5)); // max 5 cities
  else if (regions.length > 0) locations.push(...regions.slice(0, 3));
  else if (countries.length > 0) locations.push(...countries.slice(0, 2));
  else locations.push(geographicFocus);

  const allPlaces: SerperPlace[] = [];
  
  for (const location of locations) {
    const query = `${searchTerms}${keywordStr} in ${location}`;
    console.log(`[pipeline] Serper Places query: "${query}"`);

    try {
      const response = await fetch("https://google.serper.dev/places", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl: COUNTRY_TO_GL[countries[0]] || "us", hl: "en", num: 20 }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[pipeline] Serper error:", response.status, errText);
        throw new Error(`Serper API error (${response.status}). Check your API key in Admin → Settings.`);
      }

      const data = await response.json();
      const places: SerperPlace[] = data.places || [];

      // Post-filter: only keep relevant business types
      const relevant = places.filter((p) => isRelevantPlace(p, industries));
      console.log(`[pipeline] ${location}: ${places.length} places, ${relevant.length} relevant`);
      allPlaces.push(...relevant);
    } catch (err) {
      if (err instanceof Error && err.message.includes("Serper API error")) throw err;
      console.error(`[pipeline] Search failed for ${location}:`, err);
    }
  }

  // De-duplicate by business name
  const seen = new Set<string>();
  const unique = allPlaces.filter((p) => {
    const key = (p.title || "").toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`[pipeline] Total unique real businesses: ${unique.length}`);
  return unique;
}

// ── Convert Serper places to our lead format ──
function mapPlacesToLeads(
  places: SerperPlace[],
  targetCriteria: Record<string, unknown>,
  geographicFocus: string
): Record<string, unknown>[] {
  const inferredIndustry =
    (targetCriteria.industry as string) ||
    (targetCriteria.type as string) ||
    (targetCriteria.sector as string) ||
    "Business Services";

  return places.map((place) => {
    const reviewCount = place.ratingCount || 0;
    let sizeEstimate: "small" | "medium" | "large" | "enterprise" = "small";
    if (reviewCount > 500) sizeEstimate = "enterprise";
    else if (reviewCount > 100) sizeEstimate = "large";
    else if (reviewCount > 20) sizeEstimate = "medium";

    // Parse city from address
    const addressParts = (place.address || "").split(",");
    const city = addressParts.length > 1
      ? addressParts[addressParts.length - 2]?.trim()
      : geographicFocus;

    return {
      business_name: place.title || "Unknown Business",
      website: place.website || null,
      email: null, // Google Places never gives email — leave null
      phone: place.phone || null,
      address: place.address || null,
      city: city || geographicFocus,
      region: addressParts[addressParts.length - 1]?.trim() || null,
      country: null,
      industry: place.category || inferredIndustry,
      description: place.category
        ? `${place.category} located at ${place.address || geographicFocus}`
        : `Business located in ${geographicFocus}`,
      rating: place.rating || null,
      review_count: reviewCount || null,
      size_estimate: sizeEstimate,
      contact_name: null,  // Real contact info not available from Places
      contact_role: null,
    };
  });
}

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
      // ── Step 1: Fetch company profile ──
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

      // ── Step 2: Read Serper API key from database ──
      setState((s) => ({ ...s, stage: "discovering", progress: "Checking Serper API key..." }));

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
          "Serper API key not found. Go to Admin → Settings → Lead Discovery and save your SERPER_API_KEY from serper.dev."
        );
      }

      // ── Step 3: Fetch REAL businesses from Google Places via Serper ──
      setState((s) => ({ ...s, progress: "Searching Google Places for real businesses..." }));
      await supabase.from("campaigns").update({ status: "hunting" }).eq("id", campaignId);

      const places = await fetchRealLeadsFromSerper(serperKey, targetCriteria, geographicFocus);

      if (places.length === 0) {
        throw new Error("No businesses found on Google Places. Try broadening your industry or location.");
      }

      // ── Step 4: Map to lead format (no AI — direct from Google data) ──
      const rawLeads = mapPlacesToLeads(places, targetCriteria, geographicFocus);
      setState((s) => ({
        ...s,
        leadsFound: rawLeads.length,
        progress: `Found ${rawLeads.length} real businesses on Google. Scoring...`,
      }));

      // ── Step 5: Score leads ──
      setState((s) => ({ ...s, stage: "scoring" }));
      await supabase.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

      const scoredLeads: Array<Record<string, unknown> & { _score: number; _reasoning: string; _qualified: boolean }> = [];

      for (let i = 0; i < rawLeads.length; i++) {
        setState((s) => ({ ...s, progress: `Scoring lead ${i + 1} of ${rawLeads.length}: ${String(rawLeads[i].business_name)}...` }));

        const { data: scoreData, error: scoreErr } = await supabase.functions.invoke("score-lead", {
          body: { lead: rawLeads[i], companyProfile },
        });

        const score = scoreErr ? 3.0 : (scoreData?.score ?? 3.0);
        const reasoning = scoreErr ? "Scoring unavailable" : (scoreData?.reasoning ?? "");
        const qualified = score >= minimumScore;

        scoredLeads.push({ ...rawLeads[i], _score: score, _reasoning: reasoning, _qualified: qualified });
      }

      const qualifiedLeads = scoredLeads.filter((l) => l._qualified);
      setState((s) => ({
        ...s,
        leadsQualified: qualifiedLeads.length,
        progress: `${qualifiedLeads.length} of ${rawLeads.length} leads qualified. Saving to database...`,
      }));

      // ── Step 6: Save leads to DB ──
      setState((s) => ({ ...s, stage: "saving_leads" }));

      const leadsToInsert = scoredLeads.map((l) => ({
        campaign_id: campaignId,
        company_id: companyId,
        business_name: (l.business_name as string) || "Unknown Business",
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
        source: "google_maps",  // Real source now!
      }));

      const { data: insertedLeads, error: insertErr } = await supabase
        .from("leads")
        .insert(leadsToInsert)
        .select("id, score, status, business_name, contact_name, contact_email, city, industry, description, website");

      if (insertErr) throw new Error(`Failed to save leads: ${insertErr.message}`);

      // Sync Hub Telemetry
      if (insertedLeads && insertedLeads.length > 0) {
        let leadsToReport = 0;
        for (const lead of insertedLeads) {
          if (lead.status === "qualified") {
            await reportEvent("new_lead", {
              label: `New lead — Google Places (Serper)`,
              metadata: { source: "google_maps", business: lead.business_name },
            });
            leadsToReport++;
          }
        }
        if (leadsToReport > 0) {
          await updateDailyMetrics({ newLeads: leadsToReport });
        }
      }

      await supabase.from("campaigns").update({
        leads_found: rawLeads.length,
        leads_qualified: qualifiedLeads.length,
        status: "outreach",
      }).eq("id", campaignId);

      // ── Step 7: Generate outreach messages for qualified leads ──
      const qualifiedInserted = insertedLeads?.filter((l) => l.status === "qualified") || [];

      if (qualifiedInserted.length > 0) {
        setState((s) => ({ ...s, stage: "generating_outreach", progress: `Generating outreach for ${qualifiedInserted.length} leads...` }));

        let messagesGenerated = 0;

        for (let i = 0; i < qualifiedInserted.length; i++) {
          const lead = qualifiedInserted[i];
          setState((s) => ({ ...s, progress: `Writing outreach ${i + 1} of ${qualifiedInserted.length}: ${lead.business_name}...` }));

          const { data: emailData, error: emailErr } = await supabase.functions.invoke("generate-outreach", {
            body: { lead, companyProfile, tone },
          });

          if (emailErr || !emailData?.subject) continue;

          const { error: msgInsertErr } = await supabase.from("outreach_messages").insert({
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

          if (!msgInsertErr) messagesGenerated++;
        }

        await supabase.from("campaigns").update({ emails_sent: messagesGenerated }).eq("id", campaignId);
        setState((s) => ({ ...s, messagesGenerated }));
      }

      // ── Step 8: Finalize ──
      await supabase.from("campaigns").update({ status: "active" }).eq("id", campaignId);

      setState((s) => ({
        ...s,
        stage: "done",
        progress: `✅ Done! ${rawLeads.length} real businesses found on Google, ${qualifiedLeads.length} qualified, ${s.messagesGenerated} outreach messages drafted.`,
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
