# CLAUDE.md — LifeLink Sync

> This file is read by Claude Code at the start of every session.
> It contains everything you need to work on this codebase correctly.
> Read it fully before touching any file.

---

## 1. WHO WE ARE

**LifeLink Sync** is an AI-powered emergency protection platform for individuals and families.
- **Founded:** 2024
- **HQ:** Madrid, Spain
- **Markets:** Spain 🇪🇸, United Kingdom 🇬🇧, Netherlands 🇳🇱
- **Website:** https://lifelink-sync.com
- **Owner/Dev:** Lee Wakeman (lee@lifelink-sync.com / leewakeman@hotmail.co.uk)

### What we do
24/7 emergency protection via:
- **SOS triggers:** App button, Bluetooth pendant, voice ("CLARA, help me")
- **CLARA AI:** Our core AI assistant — emergency coordination, wellbeing check-ins, medication reminders
- **Family Circle:** Real-time alerts and GPS to connected family members
- **Conference Bridge:** Instant family call connection during emergencies
- **Medical Profile:** Emergency data for first responders

---

## 2. TECH STACK

### Frontend
- **React 18** + **TypeScript** + **Vite** (SWC)
- **Tailwind CSS** + **shadcn/ui** (Radix UI primitives)
- **TanStack Query v5** for server state
- **React Router v6** for routing
- **react-i18next** + **i18next** for translations (EN/ES/NL)
- **Recharts** for data visualisation
- **MapLibre GL** for maps
- **Capacitor** for iOS/Android native builds
- **PWA** via vite-plugin-pwa (service worker, manifest)
- **Sentry** for error tracking

### Backend
- **Supabase** (hosted in EU Frankfurt)
  - PostgreSQL database
  - Row Level Security (RLS) on ALL tables — never disable
  - Edge Functions (Deno/TypeScript)
  - Realtime subscriptions
  - Auth (email/password + magic link)
  - Storage for uploads

### Hosting & CI
- **Vercel** for frontend deployment
- **GitHub** (`leewakeman/lifelink-sync`) → auto-deploys to Vercel on push to `main`
- Branch: `main` = PRODUCTION

### Key integrations
| Service | Purpose |
|---|---|
| **Stripe** | Subscriptions, billing, webhooks |
| **Resend** | Transactional + marketing email |
| **Twilio** | SMS, voice calls, WhatsApp (Spain) |
| **Anthropic (Claude)** | CLARA AI (claude-sonnet-4-20250514) |
| **OpenAI** | Legacy ai-chat edge function (GPT-4o-mini) — being migrated to Anthropic |
| **Facebook Graph API v20** | LifeLink Sync page, Messenger, Instagram |
| **Flic** | Bluetooth button webhook |
| **BigDataCloud** | Reverse geocoding |
| **Google Analytics 4** | Usage analytics |
| **Sentry** | Error tracking + session replay (10% sample) |

---

## 3. PROJECT STRUCTURE

```
lifelink-sync/
├── src/
│   ├── components/
│   │   ├── admin/          # Admin-only UI (AdminLayout, AdminDashboard, pages/)
│   │   ├── ai-chat/        # EnhancedChatWidget (CLARA frontend)
│   │   ├── dashboard/      # User dashboard cards and widgets
│   │   │   ├── family/     # Family SOS components
│   │   │   └── pages/      # Dashboard sub-pages
│   │   ├── family-carer/   # Family access landing page sections
│   │   ├── onboarding/     # OnboardingWizard
│   │   ├── registration/   # Registration flow components
│   │   └── ui/             # shadcn/ui base components (DO NOT MODIFY)
│   ├── contexts/
│   │   └── AuthContext.tsx # Auth state — use this, don't create new auth contexts
│   ├── hooks/
│   │   ├── useOptimizedSubscription.ts  # Subscription state (extend, don't replace)
│   │   ├── useConnections.ts            # Family connections
│   │   └── useEnhancedConnectionDisplay.ts
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts   # Supabase client — always import from here
│   │       └── types.ts    # Auto-generated DB types
│   ├── locales/
│   │   ├── en/common.json  # English translations
│   │   ├── es/common.json  # Spanish translations
│   │   └── nl/common.json  # Dutch translations
│   ├── pages/              # Route-level page components
│   └── App.tsx             # Root with all routes
├── supabase/
│   ├── functions/          # Edge functions (Deno/TypeScript)
│   │   ├── ai-chat/        # CLARA customer chat (OpenAI — migrating to Anthropic)
│   │   ├── check-subscription/
│   │   ├── stripe-webhook/
│   │   ├── connections-invite/
│   │   ├── connections-accept/
│   │   ├── family-sos-enhanced/
│   │   ├── family-sos-alerts/
│   │   ├── flic-webhook/
│   │   ├── facebook-manager/   # NEW — CLARA Facebook full control
│   │   └── [others...]
│   └── migrations/         # SQL migrations (timestamped, never delete)
├── public/                 # Static assets + legal HTML pages
├── .claude/
│   ├── settings.json       # CC permissions
│   └── plans/              # CC plan files
├── CLAUDE.md               # ← this file
├── package.json
├── vite.config.ts
└── vercel.json
```

---

## 4. CLARA — OUR AI ASSISTANT

CLARA = **C**onnected **L**ifeline **A**nd **R**esponse **A**ssistant

### Identity
- CLARA is an AI assistant, NOT a human
- Always transparent about being AI if asked
- Warm, empathetic, concise tone
- Never provides medical advice
- Always directs genuine emergencies to: 112 (Spain/EU), 999 (UK)

### Where CLARA operates
- **Customer chat widget** (`ai-chat` edge function) — website + dashboard
- **Facebook Messenger** (`facebook-manager` edge function) — auto-replies
- **WhatsApp** — via Twilio (being built)
- **Voice** — tablet dashboard mode (real-time, audio NOT stored)
- **Daily Wellbeing** add-on — proactive check-in calls
- **Medication Reminder** add-on — reminder notifications

### CLARA system prompt (for new edge functions)
```
You are CLARA (Connected Lifeline And Response Assistant), the AI assistant for 
LifeLink Sync — an emergency protection platform for individuals and families in 
Spain, UK and Netherlands.

Key facts:
- Individual Plan: €9.99/month, 7-day free trial, no credit card required
- Add-ons: Daily Wellbeing €2.99/month, Medication Reminder €2.99/month, Family Link €2.99/month
- CLARA Complete: FREE when both Daily Wellbeing + Medication Reminder are active
- Features: SOS button, CLARA AI, GPS tracking, Family Circle, Bluetooth SOS pendant
- Pendant requires paired smartphone — does not work independently
- Markets: Spain (112), UK (999), Netherlands (112)

Rules:
- Never provide medical advice or diagnoses
- Never share internal/admin/backend information
- For life-threatening emergencies: "Please call 112/999 immediately"
- Be transparent that you are an AI if asked
- Keep responses under 200 words for messaging channels
- Always offer the 7-day free trial: lifelink-sync.com
```

### Anthropic API usage in edge functions
```typescript
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
    "anthropic-version": "2023-06-01",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: CLARA_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  }),
});
```

---

## 5. PRICING & BUSINESS MODEL

| Product | Price | Notes |
|---|---|---|
| Individual Plan | €9.99/month | Core subscription |
| Daily Wellbeing add-on | €2.99/month | CLARA daily check-ins |
| Medication Reminder add-on | €2.99/month | AI medication alerts |
| Family Link add-on | €2.99/month | Per extra family member |
| CLARA Complete | FREE | Auto-unlocks when BOTH wellness add-ons active |
| Free Trial | 7 days | No credit card required |

**CLARA Complete = derived state.** It is NOT a Stripe product. It unlocks automatically when `daily_wellbeing` AND `medication_reminder` add-ons are both active. Log changes to `clara_unlock_log`.

---

## 6. DATABASE RULES — READ CAREFULLY

### Golden rules
1. **ALL tables have RLS enabled.** Never `ALTER TABLE x DISABLE ROW LEVEL SECURITY`
2. **Always use `IF NOT EXISTS`** for `CREATE TABLE` and `ADD COLUMN` in migrations
3. **Never delete migrations.** Add new ones instead
4. **Timestamp all migrations** using format `YYYYMMDDHHMMSS_description.sql`
5. **`is_admin()` function** exists — use it in RLS policies instead of hardcoding user IDs
6. **`update_updated_at_column()` trigger** exists — use it on any table with `updated_at`
7. **All functions need `SET search_path TO 'public'`** to pass linter

### Key tables
```
profiles              — user profiles (extends auth.users)
subscribers           — subscription state (is_trialing, active_addons, clara_complete_unlocked)
trial_tracking        — 7-day trial records
member_addons         — active add-ons per user
addon_catalog         — available add-ons with Stripe price IDs
subscription_plans    — plan definitions
sos_events            — emergency events
sos_locations         — GPS trail during SOS
family_groups         — family circle groups
family_memberships    — user ↔ group relationships
connections           — connection/relationship records
circle_permissions    — granular sharing permissions
live_locations        — real-time GPS (privacy-first, SOS only)
devices_flic_buttons  — Flic hardware buttons
devices_flic_events   — Flic button press events
conversations         — CLARA chat history
training_data         — CLARA knowledge base
ai_model_settings     — CLARA config (system_prompt, temperature, etc.)
social_media_accounts — OAuth tokens for social platforms
social_platform_configs — Social API config
social_media_analytics  — Post/engagement metrics
social_media_engagement — Comment/reaction tracking
unified_conversations — Cross-channel inbox (WhatsApp, Messenger, email)
unified_messages      — Messages within unified conversations
whatsapp_accounts     — WhatsApp Business accounts
whatsapp_conversations — WhatsApp threads
whatsapp_messages     — WhatsApp messages
facebook_page_id      — 1022860360912464 (LifeLink Sync)
contact_timeline      — Unified customer interaction history
contact_engagement_summary — Pre-computed lead scoring
leads                 — CRM leads
marketing_campaigns   — Campaign management
marketing_content     — Content pieces
blog_posts            — SEO blog content
organizations         — Regional call centre orgs
organization_users    — Regional operator roles
```

---

## 7. EDGE FUNCTION PATTERNS

### Standard boilerplate (copy this)
```typescript
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    // ... your logic
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("❌ function-name error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

### Auth pattern (get authenticated user in edge function)
```typescript
const authHeader = req.headers.get("Authorization");
if (!authHeader) throw new Error("No auth header");
const { data: { user }, error } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
if (error || !user) throw new Error("Unauthorized");
```

### Deploy commands
```bash
supabase functions deploy function-name           # standard (JWT required)
supabase functions deploy function-name --no-verify-jwt  # for webhooks (Meta, Stripe, Flic)
```

### Existing functions that use `--no-verify-jwt`
- `flic-webhook` — Flic hardware sends no auth
- `stripe-webhook` — Stripe sends no auth  
- `facebook-manager` — Meta webhook sends no auth

---

## 8. FRONTEND PATTERNS

### Supabase client — always import from here
```typescript
import { supabase } from "@/integrations/supabase/client";
```

### Auth — always use AuthContext
```typescript
import { useAuth } from "@/contexts/AuthContext";
const { user, session } = useAuth();
```

### Data fetching — TanStack Query
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
```

### Toast notifications — use sonner
```typescript
import { toast } from "sonner";
toast.success("Done!"); 
toast.error("Something went wrong");
```

### Path alias
```typescript
import { Something } from "@/components/Something"; // @ = src/
```

### i18n — ALL user-facing text must be translated
```typescript
import { useTranslation } from "react-i18next";
const { t } = useTranslation('common');
// Use t('key.path') — add keys to all 3 locale files: en, es, nl
```

### Route protection
- `<ProtectedRoute>` — requires auth
- `<AdminProtectedRoute>` — requires auth + admin role
- `<ProtectedSOSRoute>` — requires auth + SOS access

### Component file naming
- Pages: `PascalCase.tsx` in `src/pages/`
- Components: `PascalCase.tsx` in appropriate `src/components/` subdir
- Hooks: `useCamelCase.ts` in `src/hooks/`

---

## 9. ENVIRONMENT VARIABLES

### Supabase Edge Function Secrets (set in dashboard)
```
SUPABASE_URL                    — auto-provided
SUPABASE_SERVICE_ROLE_KEY       — auto-provided
SUPABASE_ANON_KEY               — auto-provided
ANTHROPIC_API_KEY               ✅ set
OPENAI_API_KEY                  ✅ set (legacy, migrating to Anthropic)
STRIPE_SECRET_KEY               ✅ set
STRIPE_WEBHOOK_SECRET           ✅ set
STRIPE_PUBLISHABLE_KEY          ✅ set
TWILIO_PHONE_NUMBER             ✅ set
RESEND_API_KEY                  ✅ set
FACEBOOK_PAGE_ACCESS_TOKEN      ✅ set (system user token, never expires)
FACEBOOK_PAGE_ID                ✅ set (1022860360912464)
FACEBOOK_APP_ID                 ✅ set
FACEBOOK_WEBHOOK_VERIFY_TOKEN   — set to: lifelink_clara_2026
GITHUB_REPO_NAME                ✅ set
GITHUB_APP_ID                   ✅ set
GITHUB_APP_PRIVATE_KEY          ✅ set
GITHUB_INSTALLATION_ID          ✅ set
```

### Vite env vars (in .env / Vercel)
```
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

---

## 10. SOCIAL MEDIA & FACEBOOK

### Facebook page
- **Page:** LifeLink Sync
- **Page ID:** `1022860360912464`
- **Business Manager:** LifeLink (business.facebook.com)
- **Meta Developer App:** CLARA
- **System User:** CLARA (admin role, full control)

### CLARA's Facebook capabilities (facebook-manager edge function)
- Post content to the page
- Reply to / delete comments
- Send/receive Messenger messages (auto-replies via Anthropic)
- Pull page insights and analytics
- Handle Meta webhooks (messages, feed, mentions)
- Webhook verify token: `lifelink_clara_2026`

### Instagram
- Connected to LifeLink Sync Facebook page (Connect Instagram button shown)
- Add to `facebook-manager` when Instagram is linked

### WhatsApp (in progress)
- Twilio integration for Spain
- Meta WhatsApp Business API for templates
- Options: Approved templates (3-5 days), Invite links (now), Spain SIM +34 (2 weeks)

---

## 11. WHAT'S LIVE VS IN PROGRESS

### ✅ Live in production
- Full user auth (email + magic link)
- Dashboard with all cards
- SOS system (app button, Bluetooth pendant, voice)
- Family Circle (invites, real-time alerts, live SOS map)
- CLARA customer chat (ai-chat edge function)
- Stripe subscriptions + webhooks
- Add-on marketplace (Daily Wellbeing, Medication Reminder, Family Link)
- CLARA Complete auto-unlock
- 7-day free trial (no card)
- Connections system (invite, accept, location sharing choice)
- Flic button integration
- Tablet dashboard (always-on mode, voice activation)
- i18n (EN/ES/NL)
- Admin dashboard (users, subscriptions, analytics, content)
- Regional Spain call centre
- Blog / SEO content system
- Unified inbox (email + WhatsApp + Messenger)
- Marketing campaign tools (Riven AI)

### 🔧 In progress / recently built
- `facebook-manager` edge function — CLARA full Facebook control
- WhatsApp outreach (invite links + Meta templates)
- Admin Facebook management page

### 📋 Planned
- WhatsApp approved templates (submitted to Meta)
- Spain +34 WhatsApp Business number
- Instagram integration (page connected, API pending)

---

## 12. CRITICAL DO NOTs

- ❌ **Never disable RLS** on any table
- ❌ **Never delete or modify existing migrations** — add new ones
- ❌ **Never hardcode Supabase URLs or keys** in source code
- ❌ **Never expose secrets** in logs or error messages
- ❌ **Never remove existing RLS policies** — add alongside
- ❌ **Never use `<form>` HTML tags** in React — use onClick handlers
- ❌ **Never use `localStorage` or `sessionStorage`** — use React state or Supabase
- ❌ **Never create a new auth context** — use the existing AuthContext
- ❌ **Never import Supabase client directly** — always use `@/integrations/supabase/client`
- ❌ **Never modify `src/components/ui/`** — these are shadcn base components
- ❌ **Never push directly to main without building first** — run `npm run build` to check TypeScript
- ❌ **Never make CLARA claim to be human** or provide medical advice
- ❌ **Never share the Facebook Page Access Token** in logs, responses, or any output

---

## 13. COMMANDS REFERENCE

```bash
# Development
npm run dev                    # Start dev server on :8080

# Build & type check
npm run build                  # Production build
npx tsc --noEmit --skipLibCheck # Type check without building

# Supabase
supabase functions deploy function-name
supabase functions deploy function-name --no-verify-jwt
supabase db push               # Apply pending migrations

# Validate i18n JSON files
node -e "JSON.parse(require('fs').readFileSync('src/locales/en/common.json','utf8')); console.log('EN: valid')"
node -e "JSON.parse(require('fs').readFileSync('src/locales/es/common.json','utf8')); console.log('ES: valid')"
node -e "JSON.parse(require('fs').readFileSync('src/locales/nl/common.json','utf8')); console.log('NL: valid')"

# Git
git add [files]
git commit -m "feat: description"
git push origin main           # Triggers Vercel deploy
```

---

## 14. TONE & BRAND

- **Brand colour:** `#ef4444` (red-500) — used throughout
- **Dark theme:** `#020617` (slate-950) background
- **Font:** System default / Tailwind default
- **Tone of voice:** Warm, trustworthy, clear — never clinical or cold
- **Tagline:** "Always There. Always Ready."
- **Emergency always trumps everything** — any UI that involves SOS must be instant and obvious

---

## 15. CONTACTS & KEYS

- **Lee Wakeman** — founder/owner, does all development with Claude Code
- **Corey** — test user / WhatsApp sandbox tester
- **Supabase project ref:** `mqroziggaalltuzoyyao`
- **GitHub repo:** `leewakeman/lifelink-sync` (private)
- **Vercel project:** LifeLink Sync → lifelink-sync.com

---

## 16. LOVABLE SYNC PROTECTION

Lovable auto-syncs from its own repo and WILL overwrite edge functions with broken versions containing wrong table names. After every sync from Lovable, these files MUST be restored from our version.

### Protected edge functions (never let Lovable overwrite):
- `supabase/functions/send-outreach/index.ts`
- `supabase/functions/handle-reply/index.ts`
- `supabase/functions/run-campaign-pipeline/index.ts`
- `supabase/functions/score-lead/index.ts`
- `supabase/functions/generate-outreach/index.ts`
- `supabase/functions/ai-call/index.ts`
- `supabase/functions/strategy-analysis/index.ts`
- `supabase/functions/enrich-lead/index.ts`
- `supabase/functions/find-decision-maker/index.ts`

### Critical fixes that must NEVER be reverted:

1. **TABLE NAMES** — The real database tables are:
   - `outreach_emails` (NOT `outreach_messages`)
   - `email_replies` (NOT `inbound_replies`)
   - `companies` (NOT `company_profiles`)
   Every edge function must use these exact table names.

2. **SCORE-LEAD** — Must never crash the pipeline.
   On any AI failure return:
   `{ score: 3.0, qualified: true, reasoning: "Auto-scored — review manually" }`
   Never return an HTTP error from score-lead.

3. **RUN-CAMPAIGN-PIPELINE** — Must use `EdgeRuntime.waitUntil()`
   to run in background. Must return `{ run_id }` immediately.
   Never await the full pipeline execution.
   Must generate outreach for ALL leads not just qualified.

4. **GENERATE-OUTREACH** — Must include full company context:
   name, services, selling_points, target_markets,
   tone_preference, pricing_summary, description.
   Must include full lead context:
   business_name, industry, city, contact_name,
   contact_role, website, score_reasoning, web_snippets.

5. **CORS** — All edge functions must have:
   `Access-Control-Allow-Origin: *`
   NOT hardcoded to `https://aisales-sync.com`

### After every Lovable sync:
```bash
# Always run after sync-from-lovable.sh:
~/agent-aura-56/protect-edge-functions.sh
```

### Sync workflow:
1. CC makes changes → `git add .` → `git commit` → `git push`
2. Run sync: `~/agent-aura-56/sync-from-lovable.sh`
3. Run protect: `~/agent-aura-56/protect-edge-functions.sh`
4. Deploy functions: `supabase functions deploy [name] --project-ref cprbgquiqbyoyrffznny`

### AI Sales Sync Supabase project ref: `cprbgquiqbyoyrffznny`

---

*Last updated: March 2026 by Claude*
*If you update something significant, update this file too.*
