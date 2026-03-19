import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseClient,
  checkDeadSwitch,
  checkRateLimit,
  optionsResponse,
  jsonResponse,
  errorResponse,
  callAI,
  extractToolCallArgs,
  logActivity,
} from "../_shared/utils.ts";
import { validateRequired, validateUUID } from "../_shared/validators.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    const body = await req.json();

    // Validate input
    const validationError = validateRequired(body, ["company_id"]);
    if (validationError) return errorResponse(validationError, 400);

    const { company_id } = body;
    if (!validateUUID(company_id))
      return errorResponse("Invalid company_id format", 400);

    // Rate limit
    if (!checkRateLimit(`strategy-analysis:${company_id}`, 3, 120_000)) {
      return errorResponse(
        "Rate limit exceeded. Please try again in a moment.",
        429,
      );
    }

    const sb = getSupabaseClient();

    // Check dead switch
    const isKilled = await checkDeadSwitch(sb);
    if (isKilled) {
      return errorResponse("AI operations are currently disabled by admin.", 503);
    }

    // Pull all data in parallel
    const [
      campaignsResult,
      leadsResult,
      outreachResult,
      proposalsResult,
      dealsResult,
      companyResult,
    ] = await Promise.all([
      // All campaigns
      sb
        .from("campaigns")
        .select(
          "id, name, status, leads_found, leads_qualified, emails_sent, replies_received, calls_made, meetings_booked, proposals_sent, deals_won, estimated_deal_value",
        )
        .eq("company_id", company_id),

      // All leads with status distribution
      sb
        .from("leads")
        .select("id, status, score, campaign_id, created_at")
        .eq("company_id", company_id),

      // All outreach with response data
      sb
        .from("outreach_messages")
        .select(
          "id, status, channel, sent_at, opened_at, replied_at, campaign_id",
        )
        .eq("company_id", company_id),

      // Proposals with acceptance data
      sb
        .from("proposals")
        .select("id, status, deal_value, campaign_id, created_at")
        .eq("company_id", company_id),

      // Deals with values
      sb
        .from("deals")
        .select(
          "id, status, annual_value, monthly_value, one_time_value, campaign_id, won_at, lost_at, lost_reason, created_at",
        )
        .eq("company_id", company_id),

      // Company info
      sb
        .from("companies")
        .select("name, industry, services, target_markets")
        .eq("id", company_id)
        .maybeSingle(),
    ]);

    const campaigns = campaignsResult.data || [];
    const leads = leadsResult.data || [];
    const outreach = outreachResult.data || [];
    const proposals = proposalsResult.data || [];
    const deals = dealsResult.data || [];
    const company = companyResult.data;

    // Calculate lead status distribution
    const leadStatusDist: Record<string, number> = {};
    for (const lead of leads) {
      leadStatusDist[lead.status] = (leadStatusDist[lead.status] || 0) + 1;
    }

    // Calculate outreach response rates
    const outreachSent = outreach.filter(
      (o) => o.sent_at || o.status === "sent" || o.status === "opened" || o.status === "replied",
    ).length;
    const outreachOpened = outreach.filter(
      (o) => o.opened_at || o.status === "opened" || o.status === "replied",
    ).length;
    const outreachReplied = outreach.filter(
      (o) => o.replied_at || o.status === "replied",
    ).length;

    const responseRate =
      outreachSent > 0
        ? ((outreachReplied / outreachSent) * 100).toFixed(1)
        : "0";
    const openRate =
      outreachSent > 0
        ? ((outreachOpened / outreachSent) * 100).toFixed(1)
        : "0";

    // Calculate proposal acceptance rate
    const proposalsSent = proposals.filter(
      (p) => p.status !== "draft",
    ).length;
    const proposalsAccepted = proposals.filter(
      (p) => p.status === "accepted",
    ).length;
    const proposalAcceptanceRate =
      proposalsSent > 0
        ? ((proposalsAccepted / proposalsSent) * 100).toFixed(1)
        : "0";

    // Calculate deal values and conversion
    const dealsWon = deals.filter((d) => d.status === "won");
    const totalDealValue = dealsWon.reduce((sum, d) => {
      return (
        sum +
        (Number(d.annual_value) || 0) +
        (Number(d.monthly_value) || 0) * 12 +
        (Number(d.one_time_value) || 0)
      );
    }, 0);
    const avgDealValue =
      dealsWon.length > 0 ? totalDealValue / dealsWon.length : 0;

    // Overall conversion rate: leads -> deals won
    const conversionRate =
      leads.length > 0
        ? ((dealsWon.length / leads.length) * 100).toFixed(1)
        : "0";

    // Campaign-level comparison
    const campaignComparison = campaigns.map((c) => {
      const campaignLeads = leads.filter(
        (l) => l.campaign_id === c.id,
      ).length;
      const campaignOutreach = outreach.filter(
        (o) => o.campaign_id === c.id,
      );
      const campaignSent = campaignOutreach.filter(
        (o) => o.sent_at || o.status === "sent" || o.status === "opened" || o.status === "replied",
      ).length;
      const campaignReplied = campaignOutreach.filter(
        (o) => o.replied_at || o.status === "replied",
      ).length;
      const campaignDealsWon = deals.filter(
        (d) => d.campaign_id === c.id && d.status === "won",
      ).length;

      return {
        name: c.name,
        status: c.status,
        leads: campaignLeads,
        outreach_sent: campaignSent,
        replies: campaignReplied,
        response_rate:
          campaignSent > 0
            ? ((campaignReplied / campaignSent) * 100).toFixed(1) + "%"
            : "N/A",
        deals_won: campaignDealsWon,
      };
    });

    // Build AI prompt
    const analysisData = {
      company: {
        name: company?.name || "Unknown",
        industry: company?.industry || "Unknown",
      },
      overview: {
        total_campaigns: campaigns.length,
        total_leads: leads.length,
        total_outreach: outreach.length,
        total_proposals: proposals.length,
        total_deals: deals.length,
        deals_won: dealsWon.length,
        total_revenue: totalDealValue,
      },
      lead_status_distribution: leadStatusDist,
      outreach_metrics: {
        sent: outreachSent,
        opened: outreachOpened,
        replied: outreachReplied,
        open_rate: openRate + "%",
        response_rate: responseRate + "%",
      },
      proposal_metrics: {
        total: proposals.length,
        sent: proposalsSent,
        accepted: proposalsAccepted,
        acceptance_rate: proposalAcceptanceRate + "%",
      },
      deal_metrics: {
        total: deals.length,
        won: dealsWon.length,
        total_value: totalDealValue,
        avg_deal_value: avgDealValue,
        conversion_rate: conversionRate + "%",
      },
      campaign_comparison: campaignComparison,
    };

    const systemPrompt = `You are a senior sales strategy consultant. Analyze the complete sales pipeline data and provide deep strategic insights.
Focus on:
- Funnel analysis: where are leads dropping off?
- Campaign comparison: which campaigns perform best and why?
- Bottlenecks: what is slowing down the pipeline?
- Revenue forecasting: based on current trends, project future revenue
- Actionable recommendations: specific steps to improve performance

Be data-driven, reference specific numbers, and prioritize recommendations by potential impact.`;

    const userContent = `Perform a comprehensive strategy analysis for ${company?.name || "the company"}.

Complete pipeline data:
${JSON.stringify(analysisData, null, 2)}

Provide a thorough strategic analysis with funnel insights, campaign comparison, bottlenecks, revenue forecast, and prioritized recommendations.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "strategy_analysis",
          description: "Return the structured strategy analysis",
          parameters: {
            type: "object",
            properties: {
              funnel_analysis: {
                type: "string",
                description:
                  "Detailed analysis of the sales funnel, including conversion rates at each stage and where leads are dropping off",
              },
              campaign_comparison: {
                type: "string",
                description:
                  "Comparative analysis of campaign performance, identifying best and worst performers with reasons",
              },
              bottlenecks: {
                type: "array",
                items: { type: "string" },
                description:
                  "Identified bottlenecks in the pipeline, each with the problem, impact, and suggested fix",
              },
              revenue_forecast: {
                type: "string",
                description:
                  "Revenue projection based on current pipeline and conversion rates (30/60/90 day outlook)",
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description:
                  "Prioritized, actionable recommendations to improve pipeline performance",
              },
              key_metrics: {
                type: "object",
                properties: {
                  conversion_rate: {
                    type: "string",
                    description: "Overall lead-to-deal conversion rate",
                  },
                  avg_deal_value: {
                    type: "string",
                    description: "Average value of won deals",
                  },
                  response_rate: {
                    type: "string",
                    description: "Outreach response rate",
                  },
                  proposal_acceptance_rate: {
                    type: "string",
                    description: "Proposal acceptance rate",
                  },
                },
                required: [
                  "conversion_rate",
                  "avg_deal_value",
                  "response_rate",
                  "proposal_acceptance_rate",
                ],
                description: "Key performance metrics summary",
              },
            },
            required: [
              "funnel_analysis",
              "campaign_comparison",
              "bottlenecks",
              "revenue_forecast",
              "recommendations",
              "key_metrics",
            ],
          },
        },
      },
    ];

    const aiResponse = await callAI({
      systemPrompt,
      userContent,
      tools,
      toolChoice: {
        type: "function",
        function: { name: "strategy_analysis" },
      },
    });

    const strategyAnalysis = extractToolCallArgs(aiResponse);

    if (!strategyAnalysis) {
      console.error("AI did not return structured strategy analysis");
      return errorResponse("AI failed to generate strategy analysis", 500);
    }

    // Log activity (no DB insert - this is a live query)
    await logActivity(
      sb,
      "strategy_analysis",
      company_id,
      `Strategy analysis performed for ${company?.name || "company"}`,
      {
        total_leads: leads.length,
        total_outreach: outreach.length,
        deals_won: dealsWon.length,
        total_revenue: totalDealValue,
      },
    );

    // Return the analysis directly (no DB insert - live query)
    return jsonResponse({
      status: "analyzed",
      analysis: strategyAnalysis,
      raw_metrics: analysisData,
    });
  } catch (e) {
    console.error("strategy-analysis error:", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
});
