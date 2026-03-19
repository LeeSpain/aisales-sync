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

    const { company_id, week_start, week_end } = body;
    if (!validateUUID(company_id))
      return errorResponse("Invalid company_id format", 400);

    // Rate limit
    if (!checkRateLimit(`weekly-report:${company_id}`, 5, 60_000)) {
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

    // Calculate week boundaries (default: last 7 days)
    const endDate = week_end ? new Date(week_end) : new Date();
    const startDate = week_start
      ? new Date(week_start)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const startISO = startDate.toISOString();
    const endISO = endDate.toISOString();
    const startDateStr = startDate.toISOString().split("T")[0];
    const endDateStr = endDate.toISOString().split("T")[0];

    // Aggregate metrics in parallel
    const [
      leadsResult,
      outreachResult,
      proposalsResult,
      callsResult,
      dealsResult,
      companyResult,
    ] = await Promise.all([
      // Count leads by status (created or updated in the period)
      sb
        .from("leads")
        .select("id, status, business_name, score")
        .eq("company_id", company_id)
        .gte("created_at", startISO)
        .lte("created_at", endISO),

      // Count outreach sent/opened/replied in the period
      sb
        .from("outreach_messages")
        .select("id, status, sent_at, opened_at, replied_at, channel")
        .eq("company_id", company_id)
        .gte("created_at", startISO)
        .lte("created_at", endISO),

      // Count proposals in the period
      sb
        .from("proposals")
        .select("id, status, deal_value")
        .eq("company_id", company_id)
        .gte("created_at", startISO)
        .lte("created_at", endISO),

      // Count calls in the period
      sb
        .from("calls")
        .select("id, status, outcome, duration_seconds")
        .eq("company_id", company_id)
        .gte("created_at", startISO)
        .lte("created_at", endISO),

      // Deals in the period
      sb
        .from("deals")
        .select("id, status, annual_value, monthly_value, one_time_value, won_at")
        .eq("company_id", company_id)
        .gte("created_at", startISO)
        .lte("created_at", endISO),

      // Company name for context
      sb
        .from("companies")
        .select("name, industry")
        .eq("id", company_id)
        .maybeSingle(),
    ]);

    const leads = leadsResult.data || [];
    const outreach = outreachResult.data || [];
    const proposals = proposalsResult.data || [];
    const calls = callsResult.data || [];
    const deals = dealsResult.data || [];
    const company = companyResult.data;

    // Aggregate lead counts by status
    const leadsByStatus: Record<string, number> = {};
    for (const lead of leads) {
      leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;
    }

    // Aggregate outreach metrics
    const outreachSent = outreach.filter(
      (o) => o.status === "sent" || o.sent_at,
    ).length;
    const outreachOpened = outreach.filter(
      (o) => o.status === "opened" || o.opened_at,
    ).length;
    const outreachReplied = outreach.filter(
      (o) => o.status === "replied" || o.replied_at,
    ).length;

    // Aggregate proposal metrics
    const proposalsSent = proposals.filter(
      (p) => p.status !== "draft",
    ).length;
    const proposalsAccepted = proposals.filter(
      (p) => p.status === "accepted",
    ).length;

    // Aggregate call metrics
    const callsCompleted = calls.filter(
      (c) => c.status === "completed",
    ).length;

    // Aggregate deal values
    const totalDealValue = deals.reduce((sum, d) => {
      return (
        sum +
        (Number(d.annual_value) || 0) +
        (Number(d.monthly_value) || 0) * 12 +
        (Number(d.one_time_value) || 0)
      );
    }, 0);
    const dealsWon = deals.filter((d) => d.status === "won").length;

    // Build metrics summary for AI
    const metricsData = {
      period: { start: startDateStr, end: endDateStr },
      leads: {
        total_new: leads.length,
        by_status: leadsByStatus,
      },
      outreach: {
        total: outreach.length,
        sent: outreachSent,
        opened: outreachOpened,
        replied: outreachReplied,
        open_rate:
          outreachSent > 0
            ? ((outreachOpened / outreachSent) * 100).toFixed(1) + "%"
            : "N/A",
        reply_rate:
          outreachSent > 0
            ? ((outreachReplied / outreachSent) * 100).toFixed(1) + "%"
            : "N/A",
      },
      proposals: {
        total: proposals.length,
        sent: proposalsSent,
        accepted: proposalsAccepted,
      },
      calls: {
        total: calls.length,
        completed: callsCompleted,
      },
      deals: {
        total: deals.length,
        won: dealsWon,
        total_value: totalDealValue,
      },
    };

    // Call AI for analysis
    const systemPrompt = `You are a sales performance analyst. Analyze the weekly CRM metrics and provide actionable insights.
Be specific, reference exact numbers, and provide practical recommendations that can be acted on immediately.
Focus on trends, opportunities, and areas needing attention.`;

    const userContent = `Generate a weekly report for ${company?.name || "the company"} (${company?.industry || "unknown industry"}).

Period: ${startDateStr} to ${endDateStr}

Metrics:
${JSON.stringify(metricsData, null, 2)}

Provide a comprehensive weekly analysis with summary, recommendations, highlights, and any concerns.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "weekly_analysis",
          description: "Return the structured weekly analysis report",
          parameters: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description:
                  "Executive summary of the week's performance (2-3 paragraphs)",
              },
              recommendations: {
                type: "array",
                items: { type: "string" },
                description:
                  "Specific, actionable recommendations for the coming week",
              },
              highlights: {
                type: "array",
                items: { type: "string" },
                description: "Positive highlights and wins from the week",
              },
              concerns: {
                type: "array",
                items: { type: "string" },
                description:
                  "Areas of concern or metrics that need attention",
              },
            },
            required: ["summary", "recommendations", "highlights", "concerns"],
          },
        },
      },
    ];

    const aiResponse = await callAI({
      systemPrompt,
      userContent,
      tools,
      toolChoice: { type: "function", function: { name: "weekly_analysis" } },
    });

    const analysis = extractToolCallArgs(aiResponse);

    if (!analysis) {
      console.error("AI did not return structured weekly analysis");
      return errorResponse("AI failed to generate weekly analysis", 500);
    }

    // Insert into weekly_reports table
    const { data: report, error: insertError } = await sb
      .from("weekly_reports")
      .insert({
        company_id,
        week_start: startDateStr,
        week_end: endDateStr,
        data: metricsData,
        ai_summary: analysis.summary as string,
        ai_recommendations: JSON.stringify({
          recommendations: analysis.recommendations,
          highlights: analysis.highlights,
          concerns: analysis.concerns,
        }),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting weekly report:", insertError);
      return errorResponse("Failed to save weekly report", 500);
    }

    // Log activity
    await logActivity(
      sb,
      "weekly_report_generated",
      company_id,
      `Weekly report generated for ${startDateStr} to ${endDateStr}`,
      {
        report_id: report.id,
        period: { start: startDateStr, end: endDateStr },
        leads_count: leads.length,
        outreach_sent: outreachSent,
        deals_won: dealsWon,
      },
    );

    return jsonResponse({
      report_id: report.id,
      summary: analysis.summary,
      recommendations: analysis.recommendations,
      highlights: analysis.highlights,
      concerns: analysis.concerns,
      metrics: metricsData,
    });
  } catch (e) {
    console.error("generate-weekly-report error:", e);
    return errorResponse(
      e instanceof Error ? e.message : "Unknown error",
      500,
    );
  }
});
