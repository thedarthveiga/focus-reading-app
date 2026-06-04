#!/usr/bin/env bash
# setup-branch-protection.sh
#
# Configures branch protection for main, develop, and release/* via GitHub CLI.
# Run once after creating the repository:
#   ./setup-branch-protection.sh <owner> <repo>
#
# Requires: gh CLI authenticated with repo admin permissions.

set -euo pipefail

OWNER="${1:?Usage: $0 <owner> <repo>}"
REPO="${2:?Usage: $0 <owner> <repo>}"

# ─── main ─────────────────────────────────────────────────────────────────────
echo "→ Configuring branch protection for: main"
cat <<EOF | gh api --method PUT "repos/$OWNER/$REPO/branches/main/protection" --input -
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Validate branch naming policy",
      "Type-check, Lint & Format",
      "Architecture boundary tests",
      "Unit tests",
      "Integration tests (in-memory)",
      "Coverage (MVP 20%)",
      "TypeScript production build",
      "Docker build + smoke test"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF
echo "✓ main protected (source: release/* only — enforced by branch-policy.yml)"

# ─── develop ──────────────────────────────────────────────────────────────────
echo "→ Configuring branch protection for: develop"
cat <<EOF | gh api --method PUT "repos/$OWNER/$REPO/branches/develop/protection" --input -
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Validate branch naming policy",
      "Type-check, Lint & Format",
      "Architecture boundary tests",
      "Unit tests",
      "Integration tests (in-memory)",
      "Coverage (MVP 20%)"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true
}
EOF
echo "✓ develop protected (source: feature/*, bugfix/*, hotfix/* — enforced by branch-policy.yml)"

# ─── release/* (via rulesets — requires GitHub Team plan or above) ─────────────
echo "→ Configuring ruleset for: release/*"
cat <<EOF | gh api --method POST "repos/$OWNER/$REPO/rulesets" --input - 2>/dev/null && echo "✓ release/* ruleset created." || echo "  ⚠ Rulesets API requires GitHub Team/Enterprise — skipping release/* ruleset. Use branch-policy.yml enforcement instead."
{
  "name": "release branches",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": [
        "refs/heads/release/**"
      ],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "required_status_checks": [
          {
            "context": "Type-check, Lint & Format"
          },
          {
            "context": "Unit tests"
          },
          {
            "context": "Integration tests (in-memory)"
          }
        ],
        "strict_required_status_checks_policy": true
      }
    },
    {
      "type": "non_fast_forward"
    },
    {
      "type": "deletion"
    }
  ]
}
EOF

echo ""
echo "Branch protection configured for $OWNER/$REPO."
echo ""
echo "Protected branches:"
echo "  main     — PRs from release/* only, 1 review, all CI, no force-push, linear history"
echo "  develop  — PRs from feature/|bugfix/|hotfix/* only, 1 review, core CI"
echo "  release/ — PRs from develop only, 1 review, core CI (via ruleset)"
echo ""
echo "Branch policy is also enforced dynamically by .github/workflows/branch-policy.yml"
