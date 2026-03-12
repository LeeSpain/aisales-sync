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

// ── Fetch real businesses from Google Places via Serper API ──
async function fetchRealLeadsFromSerper(
  serperKey: string,
  targetCriteria: Record<string, unknown>,
  geographicFocus: string
): Promise<SerperPlace[]> {
  const targetStr = Object.values(targetCriteria)
    .filter((v) => typeof v === "string" && (v as string).trim())
    .join(" ");
  const query = `${targetStr ? targetStr + " in " : ""}${geographicFocus}`;

  console.log(`[pipeline] Calling Serper Places for: "${query}"`);

  const response = await fetch("https://google.serper.dev/places", {
    method: "POST",
    headers: {
      "X-API-KEY": serperKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, gl: "us", hl: "en", num: 20 }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("[pipeline] Serper error:", response.status, errText);
    throw new Error(`Serper API error (${response.status}): Check your API key in Admin → Settings.`);
  }

  const data = await response.json();
  const places: SerperPlace[] = data.places || [];
  console.log(`[pipeline] Serper returned ${places.length} real places.`);
  return places;
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

      const { data: keyRow } = await supabase
        .from("api_keys")
        .select("key_value")
        .eq("key_name", "SERPER_API_KEY")
        .eq("is_active", true)
        .maybeSingle();

      const serperKey = keyRow?.key_value;

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
