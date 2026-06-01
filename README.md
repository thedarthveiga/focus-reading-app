# Focus Reading App — MVP

Neuroscience-based reading focus app. Matches Spotify playlists to your reading session based on chapter mood and your calibrated WPM speed.

## Architecture

Hexagonal Architecture (Ports & Adapters). The domain is completely agnostic of frameworks, databases, and HTTP clients.

```
src/
├── domain/          ← Pure business rules. Zero external imports.
├── ports/           ← Interfaces (contracts). Depends only on domain.
│   ├── driving/     ← Incoming: use case interfaces
│   └── driven/      ← Outgoing: repo + service interfaces
├── application/     ← Use case interactors. Depends on domain + ports.
└── adapters/        ← Concrete implementations. Depends on everything.
    ├── input/       ← REST controllers (Fastify)
    └── output/      ← Repositories (InMemory / Postgres) + SpotifyApiAdapter
```

**Dependency rule:** arrows always point inward. `adapters` → `application` → `ports` → `domain`. Never the reverse.

## Quick start

```bash
cp .env.example .env
# Fill in SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET

npm install
npm run start:dev
```

## Testing

```bash
npm run test:unit        # Domain + use case tests (no I/O)
npm run test:integration # Full HTTP API tests
npm run test:arch        # Hexagonal boundary enforcement
npm run test:coverage    # All tests + coverage report (≥85% required)
```

## CI Pipeline

Every push and PR runs:

1. **Type-check** — `tsc --noEmit`
2. **Lint** — ESLint with architectural boundary rules
3. **Format** — Prettier check
4. **Architecture tests** — boundary violations fail the build
5. **Unit tests** — fast, no external dependencies
6. **Integration tests** — full HTTP round-trips with stub adapters
7. **Coverage gate** — minimum 85% across branches/functions/lines
8. **Build** — production TypeScript compilation

## Branch protection

Run once after creating your GitHub repo:

```bash
chmod +x setup-branch-protection.sh
./setup-branch-protection.sh <your-github-username> <repo-name>
```

This protects `main` and `develop`: all CI checks required, 1 reviewer required, force-push disabled, linear history enforced.

## Key endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sessions/prepare` | Prepare a reading session with matched playlist |
| `POST` | `/sessions/calibrate` | Calibrate user WPM from a reading sample |
| `GET`  | `/health` | Health check |

### Prepare session

```json
POST /sessions/prepare
{
  "userId": "u-1",
  "bookId": "b-1",
  "chapterNumber": 2
}

→ 201
{
  "sessionId": "uuid",
  "estimatedMinutes": 22,
  "spotifyPlaylistId": "37i9dQZF1DX8NTLI2TtZa6",
  "focusType": "alpha-waves",
  "chapterTitle": "The Method"
}
```

## Environment secrets (GitHub)

Add these in `Settings → Secrets → Actions`:

- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`

## Swapping the backend language

Because the domain and ports are pure TypeScript interfaces with zero framework coupling, migrating to Go or Python means:

1. Rewrite `adapters/` in the target language implementing the same port contracts
2. The `domain/` and `ports/` definitions serve as the specification
3. The architecture tests define what must hold true in any implementation
