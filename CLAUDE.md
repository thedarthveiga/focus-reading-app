# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run start:dev          # Run dev server (ts-node, no build needed)
npm run test               # All tests
npm run test:unit          # Domain + use case tests (fast, no I/O)
npm run test:integration   # Full HTTP round-trips with stub adapters
npm run test:arch          # Hexagonal boundary enforcement
npm run test:coverage      # All tests + coverage report (≥20% required para MVP - AUMENTAR DEPOIS DO MVP)
npm run validate           # typecheck + lint + format check (full pre-push gate)

# Run a single test file
npx jest tests/unit/domain/domain.test.ts

# Local DynamoDB (requires Docker)
npm run docker:up          # Start LocalStack
npm run db:setup           # Create table + seed data
npm run docker:down
```

## Product

The user chooses a reading mode (focus/immersion), provides book + chapter.
The AI (Claude) estimates reading time; a personalised Spotify playlist is composed and created in the user's Spotify account.
The app starts the music + timer and blocks distractions during reading.

**Backend only.** The React Native mobile app is a separate repository.
In v2, a BFF layer will be added between mobile and this API.

## Architecture

Strict Hexagonal (Ports & Adapters). Dependency rule: arrows always point inward.

```
adapters → application → ports → domain
```

- **`src/domain/`** — Pure business rules. Zero external imports (no npm packages, no frameworks). Entities use private constructors + static factory methods that throw typed `DomainError` subclasses on invalid input.
- **`src/ports/driving/`** — Use case interfaces with typed Input/Output DTOs. All input DTOs include `correlationId: string`.
- **`src/ports/driven/`** — Repository and service contracts (`UserRepositoryPort`, `SessionRepositoryPort`, `SpotifyMusicPort`, `SpotifyAuthPort`, `AIPlaylistComposerPort`, `IdGeneratorPort`).
- **`src/application/use-cases/`** — Interactors implement driving ports by injecting driven ports. Adapter class names must never appear here.
- **`src/adapters/input/rest/`** — Fastify HTTP layer. `server.ts` is the **composition root**.
- **`src/adapters/output/`** — `dynamo/` (DynamoDB), `repositories/` (InMemory), `http/` (SpotifyAdapter, Claude adapters).
- **`src/shared/`** — Shared utilities (Pino logger singleton). Not a hexagonal layer; safe to import from application and adapters.

**Path aliases** (`@domain/*`, `@ports/*`, `@application/*`, `@adapters/*`) are configured in both `tsconfig.json` and `jest.config.ts`.

## Key design details

**Adapter selection at startup:**
- `DYNAMO_ENDPOINT` or `AWS_ACCESS_KEY_ID` → DynamoDB adapters; else InMemory.
- `ANTHROPIC_API_KEY` defined → `ClaudePlaylistComposerAdapter`; else `ClaudePlaylistComposerMockAdapter`.

**Correlation ID:** Every request must include `X-Correlation-Id` header. Missing header → HTTP 400. The ID is propagated through the entire chain (controller → use case → adapters) and echoed in the response header.

**DynamoDB single-table design:** All entities share one table (`focus-reading`). Key prefixes: `USER#<id>`, `SESSION#<id>` with `#METADATA` sort keys. All key construction is centralised in `src/adapters/output/dynamo/DynamoKeys.ts`.

**Architecture tests** (`tests/architecture/hexagonal.test.ts`) parse raw import statements and fail the build if any inner layer imports from an outer one.

**Integration tests** (`tests/integration/api.test.ts`) use stub adapters — no real Spotify or Claude calls.

**Coverage thresholds** (configured in `jest.config.ts`): branches 20%, functions/lines/statements 20%. `src/adapters/input/rest/server.ts` is excluded from collection.

## Domain error hierarchy

```
DomainError (base)
├── EntityNotFoundError  → HTTP 404
├── InvalidValueError    → HTTP 422
└── ExternalServiceError → HTTP 502 (Spotify, Claude API failures)
```

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Yes (prod) | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes (prod) | Spotify API client secret (for search) |
| `SPOTIFY_REDIRECT_URI` | Yes (prod) | OAuth2 callback URI |
| `ANTHROPIC_API_KEY` | Optional | Claude API key — absent activates mock composer |
| `DYNAMO_ENDPOINT` | Optional | LocalStack endpoint — triggers DynamoDB adapters |
| `DYNAMO_TABLE_NAME` | Optional | Table name (default `focus-reading`) |
| `PORT` | Optional | HTTP port (default `3000`) |
| `LOG_LEVEL` | Optional | Pino log level (default `info`) |
