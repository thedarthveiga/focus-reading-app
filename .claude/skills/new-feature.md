# Skill: new-feature

Use this skill whenever you are about to start implementing something new — a feature, a bugfix, or a refactor. Always create a proper branch before touching any code.

## Trigger

Invoke automatically when the user says things like:
- "vamos implementar X"
- "cria a feature Y"
- "começa a implementação de Z"
- "quero adicionar X"
- "precisamos de Y"

## Rules

### Branch naming

Format: `<type>/<description-in-kebab-case>`

- `type` must be one of: `feature`, `bugfix`, `hotfix`
- `description` must be **at most 4 words** in kebab-case (lowercase, hyphens only)
- Describe **what** is being built, not the implementation detail

**Valid:**
```
feature/spotify-oauth2-pkce
feature/wpm-calibration-screen
feature/dynamo-user-adapter
bugfix/session-duration-overflow
hotfix/auth-token-expiry
```

**Invalid:**
```
feature/implementar-o-adapter-de-usuario-no-dynamo   ← more than 4 words
feature/SpotifyOAuth                                 ← not kebab-case
feature/spotify_oauth                                ← underscores not allowed
fix/something                                        ← must use bugfix/, not fix/
```

### Source branch

- **Always** branch from `develop`
- **Never** branch from `main` or from another feature branch

## Steps to follow

1. Generate a branch name (max 4 words, kebab-case) based on what will be implemented.
2. Show the proposed name to the user and ask for confirmation before creating anything:
   ```
   Branch que vou criar: feature/spotify-playlist-matching
   Confirma? (s/n)
   ```
3. After confirmation, run:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/<name>
   git push -u origin feature/<name>
   ```
4. Confirm the branch is active and the remote is set, then proceed with the implementation.

## Constraints

- Never skip the confirmation step.
- Never create the branch from `main`, `release/*`, or another feature branch.
- If `develop` doesn't exist locally, fetch it first: `git fetch origin develop`.
- If the user rejects the proposed name, generate an alternative and ask again.

## Protected branches

`develop` and `main` are protected branches — **never edit files or commit directly on them**, even for trivial changes. The repo enforces GitFlow via `branch-policy.yml`, which validates that every PR originates from a valid branch type. Direct commits to protected branches violate this policy and will be rejected.
