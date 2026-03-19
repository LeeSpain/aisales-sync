import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { optionsResponse, jsonResponse, errorResponse, checkRateLimit } from "../_shared/utils.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();

  try {
    if (!checkRateLimit("seed-users", 5, 60_000)) {
      return errorResponse("Rate limit exceeded. Please try again in a moment.", 429);
    }

    // Service-role client — bypasses RLS, has admin auth access
    // Uses custom auth config so cannot use getSupabaseClient()
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const results: string[] = [];

    // ── Helper: create one full user ──
    async function createFullUser(opts: {
      email: string;
      password: string;
      fullName: string;
      companyName: string;
      industry: string;
      plan: string;
      planStatus: string;
      monthlyAmount: number;
      role: "admin" | "client";
    }) {
      // 1. Check if user already exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: any) => u.email === opts.email);

      let userId: string;

      if (existing) {
        userId = existing.id;
        results.push(`${opts.email}: user already exists (${userId}), updating records...`);

        // Update password
        await supabase.auth.admin.updateUserById(userId, {
          password: opts.password,
          email_confirm: true,
        });
      } else {
        // 2. Create auth user (auto-confirmed)
        const { data: newUser, error: authErr } = await supabase.auth.admin.createUser({
          email: opts.email,
          password: opts.password,
          email_confirm: true,
          user_metadata: { full_name: opts.fullName },
        });
        if (authErr) throw new Error(`Auth create failed for ${opts.email}: ${authErr.message}`);
        userId = newUser.user.id;
        results.push(`${opts.email}: auth user created (${userId})`);
      }

      // 3. Upsert company
      let companyId: string;
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", userId)
        .maybeSingle();

      if (existingCompany) {
        companyId = existingCompany.id;
        await supabase.from("companies").update({
          name: opts.companyName,
          industry: opts.industry,
          status: "active",
        }).eq("id", companyId);
        results.push(`  Company updated: ${opts.companyName} (${companyId})`);
      } else {
        const { data: newCompany, error: compErr } = await supabase
          .from("companies")
          .insert({
            name: opts.companyName,
            owner_id: userId,
            industry: opts.industry,
            description: `${opts.role === "admin" ? "Platform owner" : "Client"} account`,
            status: "active",
          })
          .select("id")
          .single();
        if (compErr) throw new Error(`Company create failed: ${compErr.message}`);
        companyId = newCompany.id;
        results.push(`  Company created: ${opts.companyName} (${companyId})`);
      }

      // 4. Upsert profile
      const { error: profErr } = await supabase
        .from("profiles")
        .upsert({
          id: userId,
          email: opts.email,
          full_name: opts.fullName,
          company_id: companyId,
          onboarding_completed: true,
        }, { onConflict: "id" });
      if (profErr) throw new Error(`Profile upsert failed: ${profErr.message}`);
      results.push(`  Profile set: onboarding_completed=true, company linked`);

      // 5. Upsert subscription
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (existingSub) {
        await supabase.from("subscriptions").update({
          plan: opts.plan,
          status: opts.planStatus,
          monthly_amount: opts.monthlyAmount,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq("id", existingSub.id);
        results.push(`  Subscription updated: ${opts.plan} (${opts.planStatus})`);
      } else {
        const { error: subErr } = await supabase.from("subscriptions").insert({
          company_id: companyId,
          plan: opts.plan,
          status: opts.planStatus,
          monthly_amount: opts.monthlyAmount,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        });
        if (subErr) throw new Error(`Subscription create failed: ${subErr.message}`);
        results.push(`  Subscription created: ${opts.plan} (${opts.planStatus})`);
      }

      // 6. Upsert user role
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingRole) {
        await supabase.from("user_roles").update({ role: opts.role }).eq("id", existingRole.id);
        results.push(`  Role updated: ${opts.role}`);
      } else {
        const { error: roleErr } = await supabase.from("user_roles").insert({
          user_id: userId,
          role: opts.role,
        });
        if (roleErr) throw new Error(`Role create failed: ${roleErr.message}`);
        results.push(`  Role created: ${opts.role}`);
      }

      return userId;
    }

    // ── Create Super Admin ──
    results.push("=== SUPER ADMIN ===");
    await createFullUser({
      email: "leewakeman@hotmail.co.uk",
      password: "test1234",
      fullName: "Lee Wakeman",
      companyName: "AI Sales Sync HQ",
      industry: "SaaS / Technology",
      plan: "enterprise",
      planStatus: "active",
      monthlyAmount: 0,
      role: "admin",
    });

    // ── Create Client Admin ──
    results.push("\n=== CLIENT ADMIN ===");
    await createFullUser({
      email: "test@tes.com",
      password: "test1234",
      fullName: "Test Client",
      companyName: "Test Client Ltd",
      industry: "Marketing",
      plan: "growth",
      planStatus: "trialing",
      monthlyAmount: 1250,
      role: "client",
    });

    results.push("\n✅ All done! Both accounts ready to use.");

    return jsonResponse({ success: true, log: results });
  } catch (err) {
    return errorResponse((err as Error).message, 500);
  }
});
