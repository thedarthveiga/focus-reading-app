# Branch Strategy

## Flow

```
feature/*  ──┐
bugfix/*   ──┼──→  develop  ──→  release/vX.Y.Z  ──→  main
hotfix/*   ──┘                                          │
              └──────────────────────────────────────────┘
                         (hotfix merges into both)
```

| Branch | Purpose | Merges into | Source |
|---|---|---|---|
| `feature/*` | New functionality | `develop` | `develop` |
| `bugfix/*` | Non-urgent bug fix | `develop` | `develop` |
| `hotfix/*` | Urgent production fix | `develop` + `main` | `main` |
| `develop` | Integration branch | `release/*` | — |
| `release/vX.Y.Z` | Release stabilisation | `main` | `develop` |
| `main` | Production-ready code | — | `release/*` |

## Branch naming convention

Format: `<type>/<short-description-in-kebab-case>`

- Max 4 words in the description
- All lowercase, hyphens only (no underscores, no slashes inside)

**Valid examples:**

```
feature/spotify-oauth2-pkce
feature/wpm-calibration-screen
feature/dynamo-user-adapter
bugfix/session-duration-overflow
hotfix/auth-token-expiry
release/v1.2.0
```

**Invalid examples:**

```
feature/implementar-o-adapter-de-usuario-no-dynamo  ← more than 4 words
feature/SpotifyOAuth                                ← not kebab-case
feature/spotify_oauth                               ← underscores not allowed
fix/something                                       ← must use bugfix/ not fix/
```

## How to start a feature

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name
git push -u origin feature/your-feature-name
```

Then open a PR targeting `develop` when ready.

## How to create a release

```bash
git checkout develop
git pull origin develop
git checkout -b release/v1.2.0
# bump version in package.json if needed
git push -u origin release/v1.2.0
```

Open a PR from `release/v1.2.0` → `main`. After merge, tag the commit:

```bash
git checkout main && git pull origin main
git tag v1.2.0
git push origin v1.2.0
```

This triggers the `release.yml` workflow, which builds the changelog and creates the GitHub Release, and the `deploy.yml` workflow, which pushes to ECR and deploys to ECS.

## How to do a hotfix in production

```bash
git checkout main
git pull origin main
git checkout -b hotfix/fix-description
# make the fix, commit
git push -u origin hotfix/fix-description
```

Open **two** PRs:
1. `hotfix/fix-description` → `main` (immediate fix)
2. `hotfix/fix-description` → `develop` (keep branches in sync)

After both are merged, tag `main` with the patch version bump (e.g. `v1.1.1`).
