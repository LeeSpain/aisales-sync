import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  optionsResponse,
  jsonResponse,
  errorResponse,
  logActivity,
} from "../_shared/utils.ts";
import { validateRequired, validateUUID } from "../_shared/validators.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ExtractedContact {
  name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  source: "contact_page" | "snippet" | "domain_pattern";
  confidence: "verified" | "likely" | "guessed";
  raw_source: string;
}

interface SerperResult {
  title?: string;
  link?: string;
  snippet?: string;
  position?: number;
}

interface QueryResult {
  query: string;
  queryIndex: number;
  results: SerperResult[];
}

type SupabaseClient = ReturnType<typeof getSupabaseClient>;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractDomain(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return website.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].trim() || null;
  }
}

const TARGET_ROLES = ["CEO", "Founder", "Owner", "Director", "Managing Director"];

// ─────────────────────────────────────────────────────────────────────────────
// Email extraction — multiple strategies
// ─────────────────────────────────────────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  // Filter out common false positives
  return [...new Set(matches)].filter(
    (e) =>
      !e.endsWith(".png") &&
      !e.endsWith(".jpg") &&
      !e.endsWith(".gif") &&
      !e.includes("example.com") &&
      !e.includes("email.com") &&
      !e.includes("sentry.io") &&
      !e.includes("schema.org") &&
      !e.startsWith("0") &&
      e.length < 60
  );
}

function guessEmailFromDomain(
  domain: string,
  firstName: string | null,
  lastName: string | null
): string | null {
  if (!firstName || !lastName) return null;
  const first = firstName.toLowerCase().replace(/[^a-z]/g, "");
  const last = lastName.toLowerCase().replace(/[^a-z]/g, "");
  if (!first || !last) return null;
  // Most common pattern: first.last@domain
  return `${first}.${last}@${domain}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Phone extraction — UK, EU, US, international formats
// ─────────────────────────────────────────────────────────────────────────────

const PHONE_PATTERNS = [
  // International with + prefix: +34 600 123 456, +44 7700 900000, +1 (555) 123-4567
  /\+\d{1,3}[\s\-.]?\(?\d{1,4}\)?[\s\-.]?\d{2,4}[\s\-.]?\d{2,4}[\s\-.]?\d{0,4}/g,
  // UK: 07700 900000, 020 7946 0958, 0800 123 4567
  /\b0\d{3,4}[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}\b/g,
  // EU: (34) 600 123 456, 600-123-456
  /\b\d{3}[\s\-.]?\d{3}[\s\-.]?\d{3,4}\b/g,
  // US: (555) 123-4567, 555-123-4567
  /\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}\b/g,
];

function extractPhones(text: string): string[] {
  const phones = new Set<string>();
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern) || [];
    for (const m of matches) {
      const cleaned = m.replace(/[\s\-.()]/g, "");
      // Must be at least 7 digits
      if (cleaned.replace(/\D/g, "").length >= 7) {
        phones.add(m.trim());
      }
    }
  }
  return [...phones];
}

// ─────────────────────────────────────────────────────────────────────────────
// Name extraction from LinkedIn titles and search snippets
// ─────────────────────────────────────────────────────────────────────────────

const NAME_TITLE_PATTERNS = [
  // "John Smith - CEO - Company | LinkedIn"
  /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)\s*[-–—|]\s*(?:CEO|Founder|Owner|Director|Managing Director)/i,
  // "CEO John Smith" or "Founder: Jane Doe"
  /(?:CEO|Founder|Owner|Director|Managing Director)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/i,
  // "John Smith, CEO of Company"
  /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+),?\s*(?:CEO|Founder|Owner|Director|Managing Director)/i,
];

function extractNameFromTitle(title: string): { name: string; role: string } | null {
  for (const pattern of NAME_TITLE_PATTERNS) {
    const match = title.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      // Extract the role that was matched
      const roleMatch = title.match(/\b(CEO|Founder|Owner|Director|Managing Director)\b/i);
      return { name, role: roleMatch?.[1] || "Director" };
    }
  }
  return null;
}

function extractNameFromSnippet(snippet: string): { name: string; role: string } | null {
  for (const pattern of NAME_TITLE_PATTERNS) {
    const match = snippet.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      const roleMatch = snippet.match(/\b(CEO|Founder|Owner|Director|Managing Director)\b/i);
      return { name, role: roleMatch?.[1] || "Director" };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LinkedIn URL extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractLinkedInUrl(results: SerperResult[]): string | null {
  for (const r of results) {
    if (r.link && r.link.includes("linkedin.com/in/")) {
      return r.link;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine if a result is from a contact/about page
// ─────────────────────────────────────────────────────────────────────────────

function isContactPage(url: string | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.includes("/contact") ||
    lower.includes("/about") ||
    lower.includes("/team") ||
    lower.includes("/people") ||
    lower.includes("/staff") ||
    lower.includes("/leadership") ||
    lower.includes("/our-team") ||
    lower.includes("/management")
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Core: Run 5 targeted Serper queries
// ─────────────────────────────────────────────────────────────────────────────

async function runSerperQuery(
  serperKey: string,
  query: string,
  queryIndex: number,
): Promise<QueryResult> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!res.ok) {
      console.error(`[find-dm] Serper query ${queryIndex + 1} failed: ${res.status}`);
      return { query, queryIndex, results: [] };
    }

    const data = await res.json();
    return {
      query,
      queryIndex,
      results: (data.organic as SerperResult[])?.slice(0, 5) || [],
    };
  } catch (err) {
    console.error(`[find-dm] Serper query ${queryIndex + 1} error:`, err);
    return { query, queryIndex, results: [] };
  }
}

function buildQueries(
  businessName: string,
  location: string,
  domain: string | null,
  city: string | null,
  targetRole: string,
): string[] {
  const loc = location || "";
  const q = [
    // Query 1: General decision maker search
    `"${businessName}" ${loc} CEO OR founder OR owner OR director`,
    // Query 2: LinkedIn profile search
    `site:linkedin.com/in "${businessName}" ${loc} ${targetRole}`,
    // Query 3: Contact/about page on their website
    domain ? `site:${domain} contact OR about OR team` : `"${businessName}" website contact team`,
    // Query 4: Email + contact for the city
    `"${businessName}" email contact "${city || loc}"`,
    // Query 5: Phone/mobile search
    `"${businessName}" ${loc} "${targetRole}" phone mobile`,
  ];
  return q;
}

async function findDecisionMaker(
  sb: SupabaseClient,
  serperKey: string,
  lead: Record<string, unknown>,
  updateProgressFn?: (queryIndex: number, totalQueries: number) => Promise<void>,
): Promise<{
  contacts: ExtractedContact[];
  primary: ExtractedContact | null;
  queriesRun: number;
  totalResults: number;
}> {
  const businessName = lead.business_name as string;
  const city = (lead.city as string) || null;
  const location = [city, lead.region as string, lead.country as string].filter(Boolean).join(", ");
  const domain = extractDomain(lead.website as string | null);
  const targetRole = TARGET_ROLES[0]; // CEO as primary target

  const queries = buildQueries(businessName, location, domain, city, targetRole);
  const allResults: SerperResult[] = [];

  // Run all 5 queries sequentially with progress updates
  for (let i = 0; i < queries.length; i++) {
    if (updateProgressFn) {
      await updateProgressFn(i + 1, queries.length);
    }

    const qResult = await runSerperQuery(serperKey, queries[i], i);
    allResults.push(...qResult.results);

    // Small delay between queries to avoid rate limits
    if (i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // ── Deduplicate results by URL ──
  const seen = new Set<string>();
  const uniqueResults: SerperResult[] = [];
  for (const r of allResults) {
    const key = r.link || `${r.title}::${r.snippet}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(r);
    }
  }

  console.log(`[find-dm] ${businessName}: ${queries.length} queries, ${allResults.length} raw results, ${uniqueResults.length} unique`);

  // ── Extract contacts from all results ──
  const contacts: ExtractedContact[] = [];
  const allText = uniqueResults.map((r) => `${r.title || ""} ${r.snippet || ""}`).join(" ");
  const allEmails = extractEmails(allText);
  const allPhones = extractPhones(allText);
  const linkedinUrl = extractLinkedInUrl(uniqueResults);

  // Strategy 1: LinkedIn title parse (highest name quality)
  let primaryName: { name: string; role: string } | null = null;
  for (const r of uniqueResults) {
    if (r.link?.includes("linkedin.com/in/") && r.title) {
      primaryName = extractNameFromTitle(r.title);
      if (primaryName) break;
    }
  }

  // Strategy 2: Snippet pattern matching
  if (!primaryName) {
    for (const r of uniqueResults) {
      if (r.snippet) {
        primaryName = extractNameFromSnippet(r.snippet);
        if (primaryName) break;
      }
    }
  }

  // Strategy 3: Title pattern matching (non-LinkedIn)
  if (!primaryName) {
    for (const r of uniqueResults) {
      if (r.title && !r.link?.includes("linkedin.com")) {
        primaryName = extractNameFromTitle(r.title);
        if (primaryName) break;
      }
    }
  }

  // ── Email priority ──
  // 1. Contact page email (verified)
  // 2. Snippet email (likely)
  // 3. Domain pattern guess (guessed)
  let bestEmail: string | null = null;
  let emailConfidence: "verified" | "likely" | "guessed" = "guessed";
  let emailSource: "contact_page" | "snippet" | "domain_pattern" = "domain_pattern";

  // Check contact page results first
  for (const r of uniqueResults) {
    if (isContactPage(r.link)) {
      const pageEmails = extractEmails(`${r.title || ""} ${r.snippet || ""}`);
      if (pageEmails.length > 0) {
        bestEmail = pageEmails[0];
        emailConfidence = "verified";
        emailSource = "contact_page";
        break;
      }
    }
  }

  // Fall back to any snippet email
  if (!bestEmail && allEmails.length > 0) {
    // Prefer emails matching the domain
    if (domain) {
      const domainEmail = allEmails.find((e) => e.endsWith(`@${domain}`));
      if (domainEmail) {
        bestEmail = domainEmail;
        emailConfidence = "likely";
        emailSource = "snippet";
      }
    }
    if (!bestEmail) {
      bestEmail = allEmails[0];
      emailConfidence = "likely";
      emailSource = "snippet";
    }
  }

  // Fall back to domain pattern guess
  if (!bestEmail && domain && primaryName?.name) {
    const parts = primaryName.name.split(" ");
    if (parts.length >= 2) {
      bestEmail = guessEmailFromDomain(domain, parts[0], parts[parts.length - 1]);
      emailConfidence = "guessed";
      emailSource = "domain_pattern";
    }
  }

  // ── Phone priority — just use the first found ──
  const bestPhone = allPhones.length > 0 ? allPhones[0] : null;

  // ── Build primary contact ──
  if (primaryName || bestEmail || bestPhone || linkedinUrl) {
    // Overall confidence = lowest of the parts, biased by email source
    const confidence = emailSource === "contact_page"
      ? "verified"
      : emailSource === "snippet"
        ? "likely"
        : "guessed";

    contacts.push({
      name: primaryName?.name || null,
      role: primaryName?.role || TARGET_ROLES[0],
      email: bestEmail,
      phone: bestPhone,
      linkedin_url: linkedinUrl,
      source: emailSource,
      confidence,
      raw_source: "serper_5_query",
    });
  }

  // ── Add secondary contacts from remaining emails ──
  for (const email of allEmails.slice(1, 4)) {
    if (email !== bestEmail) {
      contacts.push({
        name: null,
        role: null,
        email,
        phone: null,
        linkedin_url: null,
        source: "snippet",
        confidence: "likely",
        raw_source: "serper_5_query",
      });
    }
  }

  const primary = contacts.length > 0 ? contacts[0] : null;

  return {
    contacts,
    primary,
    queriesRun: queries.length,
    totalResults: uniqueResults.length,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const sb = getSupabaseClient();

    const killed = await checkDeadSwitch(sb);
    if (killed) return errorResponse("AI operations are currently disabled by admin.", 503);

    const body = await req.json();
    const validationError = validateRequired(body, ["lead_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { lead_id, pipeline_run_id } = body;
    if (!validateUUID(lead_id)) return errorResponse("Invalid lead_id format", 400);

    // 1. Fetch lead
    const { data: lead, error: leadError } = await sb
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadError) throw leadError;
    if (!lead) return errorResponse("Lead not found", 404);

    // 2. Check Serper toggle + get API key
    const { data: serperToggle } = await sb
      .from("provider_configs")
      .select("is_enabled")
      .eq("provider_name", "serper")
      .is("company_id", null)
      .maybeSingle();

    if (!serperToggle?.is_enabled) {
      return jsonResponse({
        success: false,
        reason: "serper_disabled",
        lead_id,
      });
    }

    let serperKey = Deno.env.get("SERPER_API_KEY");
    if (!serperKey) {
      const { data: keyRow } = await sb
        .from("api_keys")
        .select("key_value")
        .eq("key_name", "serper_api_key")
        .eq("is_active", true)
        .maybeSingle();
      serperKey = keyRow?.key_value || null;
    }

    if (!serperKey || serperKey === "configured") {
      return jsonResponse({
        success: false,
        reason: "no_serper_key",
        lead_id,
      });
    }

    // 3. Build progress callback for pipeline integration
    const progressFn = pipeline_run_id
      ? async (queryIndex: number, totalQueries: number) => {
          await sb.from("pipeline_runs").update({
            progress_message: `Hunting decision maker for ${lead.business_name}... (query ${queryIndex}/${totalQueries})`,
          }).eq("id", pipeline_run_id);
        }
      : undefined;

    // 4. Run the 5-query decision maker search
    const result = await findDecisionMaker(sb, serperKey, lead, progressFn);

    // 5. Save results to lead
    if (result.primary) {
      const p = result.primary;
      const existingResearch = (lead.research_data as Record<string, unknown>) || {};

      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Only overwrite empty fields — never clobber Apollo data
      const currentSource = lead.contact_source as string | null;
      const isApolloSource = currentSource === "apollo";

      if (p.name && !lead.contact_name && !isApolloSource) {
        updatePayload.contact_name = p.name;
      }
      if (p.role && !lead.contact_role && !isApolloSource) {
        updatePayload.contact_role = p.role;
      }
      if (p.email && !lead.contact_email && !isApolloSource) {
        updatePayload.contact_email = p.email;
        // Set email verification status based on confidence
        if (p.confidence === "verified") {
          updatePayload.email_verification_status = "valid";
        } else if (p.confidence === "likely") {
          updatePayload.email_verification_status = "risky";
        }
        // Don't set for guessed — leave null for Hunter verification
      }
      if (p.phone && !lead.contact_phone && !isApolloSource) {
        updatePayload.contact_phone = p.phone;
      }

      // Only set source/confidence if we actually wrote contact data AND not already from Apollo
      if (!isApolloSource && (updatePayload.contact_name || updatePayload.contact_email || updatePayload.contact_phone)) {
        updatePayload.contact_source = "serper";
        updatePayload.contact_confidence = p.confidence;
      }

      // Always store decision maker research in research_data
      updatePayload.research_data = {
        ...existingResearch,
        ...(p.linkedin_url ? { linkedin_url: p.linkedin_url } : {}),
        decision_maker_search: {
          primary: {
            name: p.name,
            role: p.role,
            email: p.email,
            phone: p.phone,
            linkedin_url: p.linkedin_url,
            confidence: p.confidence,
            source: p.source,
          },
          all_contacts: result.contacts.map((c) => ({
            name: c.name,
            role: c.role,
            email: c.email,
            phone: c.phone,
            linkedin_url: c.linkedin_url,
            confidence: c.confidence,
          })),
          queries_run: result.queriesRun,
          total_results: result.totalResults,
          searched_at: new Date().toISOString(),
        },
      };

      const { error: updateErr } = await sb
        .from("leads")
        .update(updatePayload)
        .eq("id", lead_id);

      if (updateErr) {
        console.error("[find-dm] Failed to update lead:", updateErr);
      }
    }

    // 6. Log activity
    await logActivity(
      sb,
      "decision_maker_search",
      lead.company_id,
      result.primary
        ? `Decision maker found for "${lead.business_name}": ${result.primary.name || "unnamed"} (${result.primary.confidence})`
        : `Decision maker search for "${lead.business_name}" — no contacts found`,
      {
        lead_id,
        queries_run: result.queriesRun,
        total_results: result.totalResults,
        contacts_found: result.contacts.length,
        primary_name: result.primary?.name,
        primary_email: result.primary?.email ? "found" : "not_found",
        primary_phone: result.primary?.phone ? "found" : "not_found",
        primary_linkedin: result.primary?.linkedin_url ? "found" : "not_found",
        primary_confidence: result.primary?.confidence,
        primary_source: result.primary?.source,
      },
    );

    return jsonResponse({
      success: true,
      lead_id,
      queries_run: result.queriesRun,
      total_results: result.totalResults,
      contacts_found: result.contacts.length,
      primary: result.primary
        ? {
            name: result.primary.name,
            role: result.primary.role,
            has_email: !!result.primary.email,
            has_phone: !!result.primary.phone,
            has_linkedin: !!result.primary.linkedin_url,
            confidence: result.primary.confidence,
            source: result.primary.source,
          }
        : null,
    });
  } catch (e) {
    console.error("find-decision-maker error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
