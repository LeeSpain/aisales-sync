# Media-sync.com - CC Build Specification
# Version 2.0 — Updated with multi-channel, LinkedIn, proposals, deals, sequences, strategy AI

## Product Overview

Media-sync.com is an AI-powered autonomous sales platform. Businesses sign up, tell the AI about their company through natural conversation (AI wizards - no forms), and the AI finds clients, scores them, writes personalised multi-channel outreach, handles replies, makes sales calls, generates commercial proposals, and tracks deals to close. The owner watches leads convert into revenue.

Brand: Media Sync | Domain: media-sync.com | Tagline: Your AI Sales Team

## Tech Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- Backend: Supabase (Postgres, Auth, Edge Functions, Realtime, Storage)
- Hosting: Vercel
- Payments: Stripe (setup fee + monthly subscription)
- Email Sending: Resend or Amazon SES with domain warming
- Search/Discovery: Google Places API + SerpAPI + web fetching
- AI Brain: Configurable per admin (OpenAI / Anthropic / Google) - switchable
- Voice Calls: Twilio + AI voice engine (configurable)
- Email Finding: Hunter.io API + pattern detection
- Contact Enrichment: Apollo.io API (LinkedIn profiles, direct dials, verified emails, company data)
- Proposal Generation: AI-generated markdown converted to PDF (via Puppeteer or similar)
- Font: Outfit (Google Fonts)

## Design System

### Colors
- Primary: #6366f1 (indigo)
- Primary Light: #818cf8
- Primary Dark: #4f46e5
- Accent: #22d3ee (cyan)
- Accent Glow: rgba(34,211,238,0.15)
- Success: #10b981
- Warning: #f59e0b
- Danger: #ef4444
- Background: #0a0b0f
- Card: #12131a
- Elevated: #1a1b25
- Input: #1e1f2e
- Border: #2a2b3d
- Border Light: #3a3b4d
- Text: #f1f1f4
- Text Muted: #8b8ca0
- Text Dim: #5a5b6e
- Gradient: linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)

### Theme
- Dark mode primary for all authenticated screens
- Light mode for public marketing pages
- Border radius: 12-20px cards, 10-14px buttons/inputs
- Subtle glow effects using accent color at low opacity
- Gradient top-bar accent on key cards

## Database Schema (Supabase Postgres)

Detailed in migration schemas, covering profiles, companies, campaigns, leads, sequence_templates, sequence_steps, outreach_messages, inbound_replies, calls, proposals, deals, weekly_reports, data_sources, chat_messages, ai_config, email_config, activity_log, subscriptions.

## App Routes

### Public (no auth)
/ - Landing page
/pricing - Pricing details
/login - Email + password
/signup - Registration + Stripe checkout

### Client (auth, role=client)
/onboarding - AI wizard (redirects here if onboarding_completed false)
/dashboard - AI briefing + stats + pipeline + activity
/campaigns - List + new via AI wizard
/campaigns/:id - Detail: leads, sequence, emails, replies, stats
/campaigns/:id/sequence - Sequence designer (AI wizard builds multi-step multi-channel sequence)
/leads - All leads, filterable by status/score/campaign/sector
/leads/:id - Full history: research, score, all outreach, replies, calls, proposals, deal
/pipeline - Deal pipeline view (kanban: qualifying > proposal > negotiating > won/lost)
/proposals - All proposals, status tracking
/proposals/:id - Proposal detail + PDF preview
/calls - History + scheduled
/inbox - All inbound replies across channels with AI drafts
/reports - Weekly reports + strategy AI + performance vs targets
/settings - Via AI wizard
/billing - Stripe portal

### Admin (auth, role=admin)
/admin - Overview (all clients, total revenue, system health)
/admin/clients - All clients
/admin/clients/:id - Client detail (their campaigns, leads, revenue, usage)
/admin/ai-config - Provider settings per purpose
/admin/email-config - Infrastructure + domain health
/admin/data-sources - Enrichment source management
/admin/billing - Revenue dashboard
/admin/activity - Global log

## Build Phases

### Phase 1: Foundation (Weeks 1-2)
Supabase setup (all tables, RLS, policies), auth (signup, login, roles), profiles + companies, app routing (public + client + admin), landing page, basic layout with chat panel placeholder

### Phase 2: AI Wizard Core (Weeks 3-4)
Chat component (context-aware, persistent), AI adapter (multi-provider routing), onboarding wizard flow (website > research > profile > targets > complete), admin AI config page, function calling framework

### Phase 3: Lead Discovery + Enrichment (Weeks 5-6)
Campaign creation via AI wizard, Google Places + SerpAPI integration, web fetch + AI research, Apollo.io enrichment integration, Hunter.io email verification, lead scoring engine, data_sources admin management, campaign stats tracking

### Phase 4: Multi-Channel Outreach (Weeks 7-8)
Sequence template designer (AI wizard builds sequences), outreach message generation (email + LinkedIn + call scripts), email sending infrastructure (Resend/SES), domain warmup system, daily send limits + scheduling, LinkedIn message drafting + manual send workflow (copy button, mark-as-sent), open/click tracking, sequence progress per lead

### Phase 5: Reply Handling + Inbox (Weeks 9-10)
Inbound email webhook processing, multi-channel reply logging (email auto, LinkedIn/call manual), AI intent classification, AI response drafting, autonomy-based auto-handling, unified inbox UI (all channels), conversation threading per lead

### Phase 6: Proposals + Deals (Weeks 11-12)
AI proposal generation from lead + company data, proposal sections builder, markdown to PDF conversion, proposal sending + tracking (viewed, accepted, rejected), deal pipeline (kanban view), deal creation + status management, pipeline value calculation

### Phase 7: Dashboard + Strategy + Reports (Weeks 13-14)
AI daily briefing, stats overview (leads, messages, replies, meetings, proposals, deals), lead list + pipeline view, activity feed, weekly report generation (cron), strategy wizard (analysis, projections, recommendations), performance vs targets, floating chat panel on all screens

### Phase 8: Voice Calls (Weeks 15-16)
Twilio integration, AI voice agent with lead context, call recording + transcription, AI call summary + outcome classification, call scheduling from sequences, meeting booking workflow

### Phase 9: Billing + Admin + Polish (Weeks 17-18)
Stripe integration (setup fee + monthly subscription), client billing portal, admin dashboard (all clients, revenue, usage), usage tracking per plan limits, rate limiting per tier, mobile responsive pass, performance optimisation, error handling + edge cases
