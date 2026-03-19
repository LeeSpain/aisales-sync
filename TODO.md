# New Campaign Audit & Hardening TODO

- [x] Add launch/pipeline dedupe guards and stronger validation UX in `src/pages/CampaignNew.tsx`
- [x] Harden pipeline lifecycle/status consistency in `src/hooks/useCampaignPipeline.ts`
- [x] Enforce realtime-company-only guard in `supabase/functions/discover-leads/index.ts`
- [x] Fix Deno typing/import diagnostics in `supabase/functions/discover-leads/index.ts`
- [x] Re-run verification (`npx tsc --noEmit`) and confirm diagnostics status
- [ ] Add Deno function workspace typing config to resolve URL-import diagnostics in editor
