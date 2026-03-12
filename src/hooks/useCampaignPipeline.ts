import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { reportEvent, updateDailyMetrics } from "@/lib/syncHub";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

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

interface SerperOrganic {
  title?: string;
  link?: string;
  snippet?: string;
}

interface WebResearch {
  description: string;   // Best single description sentence
  services: string[];    // Up to 5 services / what they do
  email: string | null;  // Email found in web snippets
  phone: string | null;  // Phone found in web snippets (supplements Places phone)
  snippets: string[];    // Raw snippets for AI scoring context
  domain: string | null; // Clean domain for email guessing
}

interface DecisionMaker {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  linkedin_name: string | null;
  source: "serper_web_search" | "linkedin" | "not_found" | "error";
}

interface ScoredLead extends Record<string, unknown> {
  _score: number;
  _reasoning: string;
  _qualified: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Bilingual search terms (English + Spanish + local variants)
const INDUSTRY_SEARCH_TERMS: Record<string, string[]> = {
  "Real Estate":        ["inmobiliaria agencia", "estate agents property"],
  "E-commerce":         ["tienda online", "ecommerce store"],
  "SaaS":               ["empresa software", "software company tech"],
  "Retail":             ["tienda comercio", "retail shop"],
  "Healthcare":         ["clinica medica", "healthcare clinic medical"],
  "Finance":            ["asesoría financiera", "financial services accountant"],
  "Marketing":          ["agencia marketing digital", "marketing agency"],
  "Hospitality":        ["hotel restaurante", "hotel restaurant"],
  "Manufacturing":      ["empresa fabricacion", "manufacturing factory"],
  "Education":          ["academia escuela", "school college training"],
  "Professional Services": ["asesoría consultoria", "consultancy professional services"],
};

const INDUSTRY_ALLOW_TERMS: Record<string, string[]> = {
  "Real Estate":        ["estate", "property", "letting", "realt", "homes", "housing",
                         "inmobiliaria", "alquiler", "agencia inmobiliaria"],
  "Finance":            ["financial", "accountant", "accounting", "insurance",
                         "mortgage", "investment", "tax", "asesorí", "contabilidad"],
  "Marketing":          ["marketing", "agency", "advertising", "digital", "seo",
                         "brand", "creative", "publicidad", "agencia"],
  "Healthcare":         ["clinic", "health", "medical", "dental", "therapy", "physio",
                         "pharmacy", "doctor", "clínica", "salud"],
  "Education":          ["school", "college", "academy", "training", "language",
                         "university", "escuela", "academia", "tutoring"],
  "Professional Services": ["consultant", "consultancy", "solicitor", "lawyer",
                         "architect", "engineer", "advisor", "asesor", "gestor"],
  "Hospitality":        ["hotel", "restaurant", "bar", "café", "bistro",
                         "resort", "spa", "catering", "hostal", "restaurante"],
  "Manufacturing":      ["manufactur", "factory", "production", "industrial",
                         "warehouse", "fabricat", "fábrica"],
  "SaaS":               ["software", "tech", "saas", "app", "platform", "cloud",
                         "development", "digital", "sistema"],
  "E-commerce":         ["online store", "ecommerce", "shop", "boutique",
                         "tienda", "store online"],
};

const KNOWN_BAD_CHAINS = [
  "alcampo", "mercadona", "lidl", "aldi", "carrefour", "eroski", "dia ",
  "tesco", "sainsbury", "asda", "morrisons", "waitrose", "iceland",
  "dunnes", "supervalu", "costco", "walmart", "amazon",
  "mcdonald", "burger king", "kfc", "subway", "starbucks", "pizza hut",
  "repsol", "cepsa", "bp ", "shell ", "galp",
  "correos", "bankia", "santander bank", "bbva bank",
];

const BAD_CATEGORIES = [
  "supermarket", "grocery", "convenience store", "hypermarket", "discount store",
  "petrol station", "gas station", "fuel station", "petrol",
  "fast food", "takeaway", "church", "mosque", "temple", "cemetery",
  "hospital", "atm", "cash machine", "government",
];

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

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/** Wait ms milliseconds — used to space out Serper API calls */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clean and validate an email address */
function extractEmail(text: string): string | null {
  const matches = text.match(/\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/g) || [];
  // Filter out common junk (noreply, example, etc.)
  const filtered = matches.filter((e) =>
    !e.includes("noreply") &&
    !e.includes("example") &&
    !e.includes("sentry") &&
    !e.includes("test@") &&
    !e.endsWith(".png") &&
    !e.endsWith(".jpg")
  );
  return filtered[0] || null;
}

/** Extract international phone numbers */
function extractPhone(text: string): string | null {
  // Match +44 7911 123456, +34 611 234 567, (0) 1234 567890, etc.
  const matches = text.match(/(?:\+?\d{1,3}[\s\-\.]?)?\(?\d{1,4}\)?[\s\-\.]?\d{2,4}[\s\-\.]?\d{2,4}[\s\-\.]?\d{0,4}/g) || [];
  const valid = matches.filter((p) => {
    const digits = p.replace(/\D/g, "");
    return digits.length >= 7 && digits.length <= 15;
  });
  return valid[0] || null;
}

/** Guess common email format from domain */
function guessContactEmail(domain: string | null): string | null {
  if (!domain) return null;
  // Most common B2B contact emails
  return `info@${domain}`;
}

/** Extract domain from URL */
function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const cleaned = url.startsWith("http") ? url : `https://${url}`;
    const d = new URL(cleaned).hostname.replace(/^www\./, "");
    return d || null;
  } catch { return null; }
}

/** Serper API wrapper with retry logic */
async function serperFetch(
  endpoint: "places" | "search" | "news",
  query: string,
  apiKey: string,
  gl = "us",
  num = 10,
  retries = 2
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`https://google.serper.dev/${endpoint}`, {
        method: "POST",
        headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, gl, hl: "en", num }),
      });
      if (res.status === 429) {
        // Rate limited — wait and retry
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`Serper ${endpoint} HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1000 * (attempt + 1));
    }
  }
  return {};
}

/** Run promises in batches of `batchSize` to avoid API rate limits */
async function batchAsync<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  batchSize: number,
  delayBetweenBatches = 500
): Promise<void> {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.allSettled(batch.map((item, j) => fn(item, i + j)));
    if (i + batchSize < items.length) await sleep(delayBetweenBatches);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER: Relevant business check
// ─────────────────────────────────────────────────────────────────────────────

function isRelevantPlace(place: SerperPlace, requestedIndustries: string[]): boolean {
  const cat = (place.category || "").toLowerCase();
  const title = (place.title || "").toLowerCase();
  const combined = `${cat} ${title}`;

  // Hard reject known bad chains by name
  if (KNOWN_BAD_CHAINS.some((chain) => combined.includes(chain))) return false;

  // Hard reject bad categories
  if (BAD_CATEGORIES.some((term) => combined.includes(term))) return false;

  // No industry filter applied → keep if passed rejects
  if (!requestedIndustries.length) return true;

  // Check against industry-specific allow terms (category OR title must match)
  const matchesIndustry = requestedIndustries.some((industry) => {
    const allowTerms = INDUSTRY_ALLOW_TERMS[industry];
    if (!allowTerms) return true; // Unknown industry — let through
    return allowTerms.some((t) => combined.includes(t));
  });

  if (matchesIndustry) return true;

  // Safety: if Serper didn't return a category, don't reject — we can't be sure
  if (!place.category && !place.title?.toLowerCase().match(
    /supermarket|grocery|station|church|mosque|hospital|pharmacy chain/
  )) return true;

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 — DISCOVER real businesses via Google Places
// ─────────────────────────────────────────────────────────────────────────────

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
  const gl = COUNTRY_TO_GL[countries[0]] || "us";
  const keywordStr = keywords.length > 0 ? ` ${keywords.join(" ")}` : "";

  // Build locations list — most specific first
  const locations: string[] = [];
  if (cities.length > 0) locations.push(...cities.slice(0, 5));
  else if (regions.length > 0) locations.push(...regions.slice(0, 3));
  else if (countries.length > 0) locations.push(...countries.slice(0, 2));
  else locations.push(geographicFocus);

  // Build multiple search term variants to maximise coverage
  const termVariants: string[] = [];
  for (const ind of industries) {
    const variants = INDUSTRY_SEARCH_TERMS[ind];
    if (variants) termVariants.push(...variants);
    else termVariants.push(ind);
  }
  // Remove duplicates and take first 3 variants to avoid too many calls
  const uniqueVariants = [...new Set(termVariants)].slice(0, 3);

  const allPlaces: SerperPlace[] = [];

  for (const location of locations) {
    let foundForLocation: SerperPlace[] = [];

    // Try each search term variant until we get results
    for (const terms of uniqueVariants) {
      const query = `${terms}${keywordStr} ${location}`;
      console.log(`[discover] "${query}" (gl=${gl})`);

      try {
        const data = await serperFetch("places", query, serperKey, gl, 20);
        const places = (data.places as SerperPlace[]) || [];

        const relevant = places.filter((p) => isRelevantPlace(p, industries));
        foundForLocation.push(...relevant);

        // If we have enough results, stop trying more variants for this location
        if (foundForLocation.length >= 10) break;
      } catch (err) {
        console.error(`[discover] Failed: "${query}"`, err);
      }

      await sleep(200); // Small delay between variants
    }

    // Safety net: if ALL got filtered, return minus-bad-chains
    if (foundForLocation.length === 0) {
      for (const terms of uniqueVariants.slice(0, 1)) {
        try {
          const data = await serperFetch("places", `${terms} ${location}`, serperKey, gl, 20);
          const places = (data.places as SerperPlace[]) || [];
          foundForLocation = places.filter((p) => {
            const c = `${(p.category || "").toLowerCase()} ${(p.title || "").toLowerCase()}`;
            return !KNOWN_BAD_CHAINS.some((chain) => c.includes(chain)) &&
                   !BAD_CATEGORIES.some((bc) => c.includes(bc));
          });
        } catch (e) { console.error("[discover] Safety net failed:", e); }
      }
    }

    allPlaces.push(...foundForLocation);
    await sleep(300); // Rate limit between locations
  }

  // Deduplicate by name (case-insensitive)
  const seen = new Set<string>();
  return allPlaces.filter((p) => {
    const key = (p.title || "").toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2 — RESEARCH each business website via Serper web search
// ─────────────────────────────────────────────────────────────────────────────

async function researchBusiness(
  serperKey: string,
  businessName: string,
  website: string | null | undefined,
  location: string,
  gl: string
): Promise<WebResearch> {
  const domain = extractDomain(website);
  const organicResults: SerperOrganic[] = [];

  // Query A: business name + city (most reliable)
  try {
    const data = await serperFetch("search", `"${businessName}" ${location}`, serperKey, gl, 5);
    organicResults.push(...((data.organic as SerperOrganic[]) || []).slice(0, 4));
  } catch (e) { console.error(`[research] Name query failed for "${businessName}":`, e); }

  // Query B: their own website's pages (if we have a domain)
  if (domain && organicResults.length < 4) {
    try {
      const data = await serperFetch("search", `site:${domain}`, serperKey, gl, 5);
      organicResults.push(...((data.organic as SerperOrganic[]) || []).slice(0, 3));
    } catch (e) { console.error(`[research] Site query failed for ${domain}:`, e); }
  }

  // Combine all text for extraction
  const allText = organicResults.map((r) => `${r.title || ""} ${r.snippet || ""}`).join(" ");

  // Build a good description from snippets (prefer domain-matched results first)
  const domainSnippets = domain
    ? organicResults.filter((r) => r.link?.includes(domain))
    : [];
  const bestSnippet = domainSnippets[0] || organicResults[0];
  const description = bestSnippet?.snippet?.trim() ||
    `${businessName} — ${bestSnippet?.title || "Business"} in ${location}`;

  // Extract structured data
  const email = extractEmail(allText);
  const phone = extractPhone(allText);

  // Extract services from snippets — look for lists, bullet patterns, "we offer" etc.
  const snippets = organicResults
    .map((r) => `${r.title || ""}: ${r.snippet || ""}`.trim())
    .filter((s) => s.length > 10)
    .slice(0, 5);

  // Heuristic: pick sentences that describe what they DO (not ads)
  const services = snippets
    .filter((s) => s.toLowerCase().match(/offer|provide|speciali|service|sell|help|solut|deliver/))
    .slice(0, 3);

  return { description, services, email, phone, snippets, domain };
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4 — FIND decision makers via Serper
// ─────────────────────────────────────────────────────────────────────────────

async function findDecisionMaker(
  serperKey: string,
  businessName: string,
  domain: string | null,
  location: string,
  targetRole: string,
  gl: string
): Promise<DecisionMaker> {
  const roleTerms = targetRole === "Any decision maker"
    ? "owner founder director CEO manager"
    : targetRole;

  const organicResults: SerperOrganic[] = [];

  // Query 1: Business + role + contact
  try {
    const q = `"${businessName}" ${location} ${roleTerms}`;
    const data = await serperFetch("search", q, serperKey, gl, 5);
    organicResults.push(...((data.organic as SerperOrganic[]) || []));
    await sleep(200);
  } catch (e) { console.error("[dm] Main query failed:", e); }

  // Query 2: LinkedIn specifically
  let linkedinUrl: string | null = null;
  let linkedinName: string | null = null;
  try {
    const liQ = `site:linkedin.com "${businessName}" ${location} ${roleTerms}`;
    const liData = await serperFetch("search", liQ, serperKey, gl, 3);
    const liResults = (liData.organic as SerperOrganic[]) || [];
    const liPerson = liResults.find((r) => r.link?.includes("linkedin.com/in/"));
    if (liPerson) {
      linkedinUrl = liPerson.link || null;
      // Extract name from LinkedIn title: usually "Name - Role at Company | LinkedIn"
      const nameMatch = liPerson.title?.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/);
      linkedinName = nameMatch?.[1] || null;
    }
  } catch (e) { console.error("[dm] LinkedIn query failed:", e); }

  // Also check domain's contact page for email
  let contactEmail: string | null = null;
  if (domain) {
    try {
      const contactData = await serperFetch("search", `site:${domain} contact`, serperKey, gl, 3);
      const contactResults = (contactData.organic as SerperOrganic[]) || [];
      const contactText = contactResults.map((r) => r.snippet || "").join(" ");
      contactEmail = extractEmail(contactText);
    } catch (e) { console.error("[dm] Contact page query failed:", e); }
  }

  const allText = organicResults.map((r) => `${r.title || ""} ${r.snippet || ""}`).join(" ");

  // Email priority: contact page > web snippets > guessed from domain
  const webEmail = extractEmail(allText);
  const finalEmail = contactEmail || webEmail || guessContactEmail(domain);

  // Phone
  const phone = extractPhone(allText);

  // Name from snippets: look for "Name - Role" patterns or intro phrases
  const namePatterns = [
    /(?:CEO|Director|Owner|Founder|Manager|Managing Director)[,:\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
    /([A-Z][a-z]+\s+[A-Z][a-z]+)(?:,?\s+(?:CEO|Director|Owner|Founder|Manager))/,
    /(?:by|from|contact|meet|team)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/,
  ];
  let detectedName: string | null = linkedinName;
  if (!detectedName) {
    for (const pattern of namePatterns) {
      const match = allText.match(pattern);
      if (match?.[1]) { detectedName = match[1]; break; }
    }
  }

  return {
    name: detectedName,
    role: targetRole !== "Any decision maker" ? targetRole : null,
    email: finalEmail,
    phone,
    linkedin_url: linkedinUrl,
    linkedin_name: linkedinName,
    source: organicResults.length > 0 ? "serper_web_search" : "not_found",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP place + research → lead object
// ─────────────────────────────────────────────────────────────────────────────

function mapPlaceToLead(
  place: SerperPlace,
  research: WebResearch,
  targetCriteria: Record<string, unknown>,
  geographicFocus: string
): Record<string, unknown> {
  const reviewCount = place.ratingCount || 0;
  const rating = place.rating || 0;

  // More nuanced size estimate using reviews + rating signals
  let sizeEstimate: "small" | "medium" | "large" | "enterprise" = "small";
  if (reviewCount > 500 || (reviewCount > 200 && rating > 4.5)) sizeEstimate = "enterprise";
  else if (reviewCount > 100) sizeEstimate = "large";
  else if (reviewCount > 25) sizeEstimate = "medium";

  // Parse city and region properly from Google Places address
  const addressParts = (place.address || "").split(",").map((p) => p.trim());
  const city = addressParts.length >= 3
    ? addressParts[addressParts.length - 3]  // 2nd from last is usually city
    : addressParts.length >= 2
      ? addressParts[addressParts.length - 2]
      : geographicFocus;

  const region = addressParts.length >= 2
    ? addressParts[addressParts.length - 2]
    : null;

  const country = addressParts[addressParts.length - 1] ||
    (targetCriteria.geo_countries as string[])?.[0] || null;

  const industry = place.category ||
    (targetCriteria.industries as string[])?.[0] ||
    "Business Services";

  // Best description: prefer web research snippet, fallback to category+address
  const description = research.description.length > 20
    ? research.description
    : place.category
      ? `${place.category} — ${place.address || geographicFocus}`
      : `Business in ${geographicFocus}`;

  return {
    business_name: place.title || "Unknown Business",
    website: place.website || null,
    email: research.email || null,
    phone: place.phone || research.phone || null,
    address: place.address || null,
    city: city || geographicFocus,
    region: region || null,
    country: country || null,
    industry,
    description,
    rating: place.rating || null,
    review_count: reviewCount || null,
    size_estimate: sizeEstimate,
    contact_name: null,
    contact_role: null,
    contact_email: research.email || null,
    _research: research,
    _domain: research.domain,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK
// ─────────────────────────────────────────────────────────────────────────────

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
      // ── Fetch company profile (used for scoring + outreach context) ──
      const { data: companyData } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      const companyProfile = companyData
        ? {
          name: companyData.name,
          industry: companyData.industry,
          services: companyData.services || [],
          target_markets: companyData.target_markets || [],
          unique_selling_points: companyData.selling_points || [],
        }
        : { name: "Company", services: [], target_markets: [], unique_selling_points: [] };

      // ── Read Serper API key ──
      setState((s) => ({ ...s, stage: "discovering", progress: "🔑 Loading API key..." }));

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
          "Serper API key not configured. Go to Admin → Settings → Lead Discovery and save your SERPER_API_KEY from serper.dev."
        );
      }

      const countries = (targetCriteria.geo_countries as string[]) || [];
      const gl = COUNTRY_TO_GL[countries[0]] || "us";
      const targetRole = (targetCriteria.target_decision_maker as string) || "Any decision maker";

      // ══════════════════════════════════════════
      // STAGE 1: DISCOVER — Google Places
      // ══════════════════════════════════════════
      setState((s) => ({
        ...s,
        stage: "discovering",
        progress: "🔍 Searching Google Places for real businesses...",
      }));
      await supabase.from("campaigns").update({ status: "hunting" }).eq("id", campaignId);

      const places = await discoverLeads(serperKey, targetCriteria, geographicFocus);

      if (places.length === 0) {
        throw new Error(
          "No businesses found on Google Places. Try a broader industry, different keywords, or a larger location."
        );
      }

      setState((s) => ({
        ...s,
        leadsFound: places.length,
        progress: `✅ Found ${places.length} real businesses on Google. Researching each one...`,
      }));

      // ══════════════════════════════════════════
      // STAGE 2: RESEARCH — website + web data
      // Parallel batches of 3 to stay within rate limits
      // ══════════════════════════════════════════
      setState((s) => ({ ...s, stage: "researching" }));

      const enrichedLeads: Array<Record<string, unknown>> = new Array(places.length);
      let researchedCount = 0;

      await batchAsync(
        places,
        async (place, index) => {
          const research = await researchBusiness(
            serperKey,
            place.title || "",
            place.website,
            geographicFocus,
            gl
          );
          enrichedLeads[index] = mapPlaceToLead(place, research, targetCriteria, geographicFocus);
          researchedCount++;
          setState((s) => ({
            ...s,
            progress: `🌐 Researching websites (${researchedCount}/${places.length}): ${place.title}...`,
          }));
        },
        3,  // 3 parallel at a time
        600 // 600ms between batches
      );

      // ══════════════════════════════════════════
      // STAGE 3: SCORE — AI rates 1-5 fit
      // ══════════════════════════════════════════
      setState((s) => ({ ...s, stage: "scoring" }));
      await supabase.from("campaigns").update({ status: "scoring" }).eq("id", campaignId);

      const scoredLeads: ScoredLead[] = [];

      for (let i = 0; i < enrichedLeads.length; i++) {
        const lead = enrichedLeads[i];
        setState((s) => ({
          ...s,
          progress: `⭐ Scoring fit ${i + 1}/${enrichedLeads.length}: ${String(lead.business_name)}...`,
        }));

        // Destructure _research and _domain out before sending to edge function
        const { _research, _domain, ...leadForScoring } = lead as Record<string, unknown> & {
          _research: WebResearch;
          _domain: string | null;
        };

        const enrichedForScoring = {
          ...leadForScoring,
          description: String(lead.description),
          web_snippets: _research?.snippets?.slice(0, 3) || [],
          services_found: _research?.services || [],
        };

        const { data: scoreData, error: scoreErr } = await supabase.functions.invoke("score-lead", {
          body: { lead: enrichedForScoring, companyProfile },
        });

        const score: number = scoreErr ? 3.0 : (scoreData?.score ?? 3.0);
        const reasoning: string = scoreErr ? "Scoring service unavailable" : (scoreData?.reasoning ?? "");
        const qualified: boolean = score >= minimumScore;

        scoredLeads.push({
          ...lead,
          _score: score,
          _reasoning: reasoning,
          _qualified: qualified,
        });
      }

      const qualifiedLeads = scoredLeads.filter((l) => l._qualified);
      setState((s) => ({
        ...s,
        leadsQualified: qualifiedLeads.length,
        progress: `✅ Scored all leads — ${qualifiedLeads.length}/${scoredLeads.length} meet the ${minimumScore}+ threshold. Saving...`,
      }));

      // ══════════════════════════════════════════
      // STAGE 3b: SAVE all leads to database
      // ══════════════════════════════════════════
      setState((s) => ({ ...s, stage: "saving_leads" }));

      const leadsToInsert = scoredLeads.map((l) => {
        const { _research: _r, _domain: _d, _score, _reasoning, _qualified, ...clean } = l as ScoredLead & {
          _research: WebResearch;
          _domain: string | null;
        };
        return {
          ...clean,
          campaign_id: campaignId,
          company_id: companyId,
          contact_name: null,
          contact_role: null,
          contact_email: (l.email as string) || (l.contact_email as string) || null,
          score: _score,
          score_reasoning: _reasoning,
          status: _qualified ? "qualified" : "scored",
          source: "google_maps",
        };
      });

      const { data: insertedLeads, error: insertErr } = await supabase
        .from("leads")
        .insert(leadsToInsert)
        .select("id, score, status, business_name, city, industry, website, contact_email");

      if (insertErr) throw new Error(`Database error saving leads: ${insertErr.message}`);

      // Sync Hub telemetry
      const qualCount = insertedLeads?.filter((l) => l.status === "qualified").length || 0;
      if (qualCount > 0) {
        await reportEvent("new_lead", {
          label: `${qualCount} new leads — Google Places`,
          metadata: { source: "google_maps", campaign_id: campaignId },
        });
        await updateDailyMetrics({ newLeads: qualCount });
      }

      await supabase.from("campaigns").update({
        leads_found: scoredLeads.length,
        leads_qualified: qualifiedLeads.length,
        status: "outreach",
      }).eq("id", campaignId);

      // ══════════════════════════════════════════
      // STAGE 4: DECISION MAKERS — for qualified leads only
      // ══════════════════════════════════════════
      const qualifiedInserted = insertedLeads?.filter((l) => l.status === "qualified") || [];

      if (qualifiedInserted.length > 0) {
        setState((s) => ({
          ...s,
          stage: "decision_makers",
          progress: `🕵️ Finding decision makers for ${qualifiedInserted.length} qualified leads...`,
        }));

        // Match inserts back to enriched leads to get their domain
        const domainMap = new Map<string, string | null>();
        scoredLeads.forEach((sl) => {
          const name = String(sl.business_name);
          const domain = (sl as ScoredLead & { _domain: string | null })._domain ?? null;
          domainMap.set(name, domain);
        });

        let dmCount = 0;
        await batchAsync(
          qualifiedInserted,
          async (lead, i) => {
            setState((s) => ({
              ...s,
              progress: `🕵️ Researching ${i + 1}/${qualifiedInserted.length}: ${lead.business_name}...`,
            }));

            const domain = domainMap.get(lead.business_name) || extractDomain(lead.website);

            // First try the edge function (full AI + Serper power)
            const { error: edgeErr } = await supabase.functions.invoke("research-lead", {
              body: { lead_id: lead.id },
            });

            if (edgeErr) {
              // Fallback: direct Serper decision maker search
              console.warn(`[pipeline] research-lead edge function failed — using direct Serper`);
              const dm = await findDecisionMaker(
                serperKey,
                lead.business_name,
                domain,
                lead.city || geographicFocus,
                targetRole,
                gl
              );

              if (dm.name || dm.email || dm.phone || dm.linkedin_url) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await supabase.from("leads").update({
                  contact_name: dm.name,
                  contact_role: dm.role,
                  contact_email: dm.email,
                  contact_phone: dm.phone,
                  research_data: {
                    decision_maker: dm,
                    linkedin_url: dm.linkedin_url,
                    source: dm.source,
                    researched_at: new Date().toISOString(),
                  } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
                }).eq("id", lead.id);
                dmCount++;
              }
            } else {
              dmCount++;
            }
          },
          2,   // 2 parallel decision maker researches
          800  // 800ms between batches (more research calls)
        );

        console.log(`[pipeline] Found decision maker info for ${dmCount}/${qualifiedInserted.length} leads`);
      }

      // ══════════════════════════════════════════
      // STAGE 5: GENERATE personalised outreach
      // ══════════════════════════════════════════
      let messagesGenerated = 0;

      if (qualifiedInserted.length > 0) {
        setState((s) => ({
          ...s,
          stage: "generating_outreach",
          progress: `✉️ Writing personalised outreach for ${qualifiedInserted.length} leads...`,
        }));

        for (let i = 0; i < qualifiedInserted.length; i++) {
          const lead = qualifiedInserted[i];
          setState((s) => ({
            ...s,
            progress: `✉️ Writing ${i + 1}/${qualifiedInserted.length}: ${lead.business_name}...`,
          }));

          const { data: emailData, error: emailErr } = await supabase.functions.invoke(
            "generate-outreach",
            { body: { lead, companyProfile, tone } }
          );

          if (emailErr || !emailData?.subject) {
            console.warn(`[pipeline] Outreach generation failed for ${lead.business_name}`);
            continue;
          }

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

        await supabase.from("campaigns")
          .update({ emails_sent: messagesGenerated })
          .eq("id", campaignId);
      }

      // ══════════════════════════════════════════
      // FINALIZE
      // ══════════════════════════════════════════
      await supabase.from("campaigns").update({ status: "active" }).eq("id", campaignId);

      setState((s) => ({
        ...s,
        stage: "done",
        messagesGenerated,
        progress: `🎯 Complete! ${scoredLeads.length} real businesses discovered · ${qualifiedLeads.length} scored ${minimumScore}+ · ${messagesGenerated} outreach emails drafted.`,
      }));

    } catch (err) {
      const message = err instanceof Error ? err.message : "Pipeline failed — please try again.";
      console.error("[pipeline] Error:", err);
      await supabase.from("campaigns").update({ status: "setup" }).eq("id", campaignId);
      setState((s) => ({ ...s, stage: "error", error: message, progress: message }));
    } finally {
      isRunningRef.current = false;
    }
  }, []);

  return { ...state, runPipeline };
}
