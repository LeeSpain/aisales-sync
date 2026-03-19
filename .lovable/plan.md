

## Root Cause

**CORS is blocking all browser requests to edge functions.**

In `supabase/functions/_shared/utils.ts`, line 4:
```typescript
const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") || "https://aisales-sync.com";
```

The preview runs on `https://id-preview--56813625-45b1-47ee-96b8-b2ca17d50a3b.lovable.app`. The browser sends this as the `Origin` header. The edge function responds with `Access-Control-Allow-Origin: https://aisales-sync.com`, which doesn't match. The browser blocks the response entirely, and the Supabase JS client throws the generic "Cannot reach the pipeline service" error.

This affects ALL edge functions, not just `run-campaign-pipeline`.

## Fix

### Step 1: Fix CORS in `_shared/utils.ts`

Change `getCorsHeaders()` to allow all origins (`*`), which is the standard pattern for Supabase edge functions called from web apps:

```typescript
export function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}
```

### Step 2: Redeploy all edge functions that use this shared util

Deploy `run-campaign-pipeline` and `discover-leads` (the two in the pipeline path). Other functions will pick up the fix on their next deploy.

### Step 3: Verify

Call the function from the browser and confirm it no longer fails with the CORS/reachability error.

---

**No database changes needed** — the `pipeline_runs` table already exists with the correct schema. The `discover-leads` function already has no `DISCOVERY_REALTIME_MODE` guard (it was removed in a prior fix). The only blocker is CORS.

