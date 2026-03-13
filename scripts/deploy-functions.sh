#!/usr/bin/env bash
# Deploy all Supabase Edge Functions
# Usage: ./scripts/deploy-functions.sh
#
# Prerequisites:
#   - Supabase CLI installed (brew install supabase/tap/supabase)
#   - Logged in (supabase login)
#   - Project linked (supabase link --project-ref <ref>)
#
# Note: If this is a Lovable-managed project, you may not have direct
# deploy access. Push to GitHub and let Lovable's pipeline deploy instead.

set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-}"

if [ -z "$PROJECT_REF" ]; then
  echo "Error: Set SUPABASE_PROJECT_REF or pass it as an env var."
  echo "Example: SUPABASE_PROJECT_REF=yixnijizjjgzlfffgcpu ./scripts/deploy-functions.sh"
  exit 1
fi

FUNCTIONS=(
  health-check
  discover-leads
  research-lead
  enrich-lead
  score-lead
  generate-outreach
  run-campaign-pipeline
  scrape-url
)

echo "Deploying ${#FUNCTIONS[@]} edge functions to project $PROJECT_REF..."
echo ""

FAILED=0
for fn in "${FUNCTIONS[@]}"; do
  echo "→ Deploying $fn..."
  if supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt; then
    echo "  ✓ $fn deployed"
  else
    echo "  ✗ $fn FAILED"
    FAILED=$((FAILED + 1))
  fi
  echo ""
done

if [ "$FAILED" -gt 0 ]; then
  echo "⚠ $FAILED function(s) failed to deploy."
  exit 1
else
  echo "All functions deployed successfully."
fi
