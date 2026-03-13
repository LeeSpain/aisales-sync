# Lead Discovery API Toggles Implementation
Status: In Progress

## Plan Steps
- [ ] 1. Create `src/hooks/useLeadApiToggles.ts` (new hook mirroring useAgentToggles)
- [x] 2. Update `src/pages/admin/AdminSettings.tsx` (add toggles to Lead Discovery section)

- [x] 2.5 Fix `src/integrations/supabase/types.ts` (add api_keys)

Current: Backend Step 3 (discover-leads/index.ts)

- [x] 3. Update `supabase/functions/discover-leads/index.ts` (check serper_api toggle)

Current: Backend Steps 4-5
- [x] 4. Update `supabase/functions/enrich-lead/index.ts` (check serper_api toggle)
 - [x] 5. Update `supabase/functions/research-lead/index.ts` (check serper_api toggle)

Current: Steps 6-8 (testing/complete)
- [ ] 6. Extend AGENTS in `src/hooks/useAgentToggles.ts` if needed (optional)
- [ ] 7. Test toggles: AdminSettings UI + backend skip when disabled
- [ ] 8. Complete: attempt_completion

Current: Starting Step 1

