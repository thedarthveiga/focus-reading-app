#!/usr/bin/env bash
# setup-branch-protection.sh
#
# Configures branch protection for main and develop via GitHub CLI.
# Run once after creating the repository:
#   ./setup-branch-protection.sh <owner> <repo>
#
# Requires: gh CLI authenticated with repo admin permissions.

set -euo pipefail

OWNER="${1:?Usage: $0 <owner> <repo>}"
REPO="${2:?Usage: $0 <owner> <repo>}"

configure_branch() {
  local BRANCH="$1"
  echo "→ Configuring branch protection for: $BRANCH"

  gh api \
    --method PUT \
    "repos/$OWNER/$REPO/branches/$BRANCH/protection" \
    --field required_status_checks='{"strict":true,"contexts":["Type-check, Lint & Format","Architecture boundary tests","Unit tests","Integration tests","Coverage (≥85%)","Production build"]}' \
    --field enforce_admins=true \
    --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true,"require_code_owner_reviews":true}' \
    --field restrictions=null \
    --field allow_force_pushes=false \
    --field allow_deletions=false \
    --field required_linear_history=true

  echo "✓ $BRANCH protected."
}

configure_branch "main"
configure_branch "develop"

echo ""
echo "Branch protection configured for $OWNER/$REPO."
echo "Protected: main, develop"
echo "Required checks: all CI jobs must pass before merge"
echo "Required reviews: 1 approving review + CODEOWNERS"
