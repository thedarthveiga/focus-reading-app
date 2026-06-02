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

## Architecture

Strict Hexagonal (Ports & Adapters). Dependency rule: arrows always point inward.

```
adapters → application → ports → domain
```

- **`src/domain/`** — Pure business rules. Zero external imports (no npm packages, no frameworks). Entities use private constructors + static factory methods that throw typed `DomainError` subclasses on invalid input.
- **`src/ports/driving/`** — Use case interfaces with typed Input/Output DTOs (`PrepareReadingSessionUseCase`, `CalibrateWpmUseCase`).
- **`src/ports/driven/`** — Repository and service contracts (`BookRepositoryPort`, `UserRepositoryPort`, `SpotifyServicePort`, `IdGeneratorPort`).
- **`src/application/use-cases/`** — Interactors implement driving ports by injecting driven ports. Adapter class names (`InMemory*`, `SpotifyApiAdapter`, `UuidGenerator`) must never appear here.
- **`src/adapters/input/rest/`** — Fastify HTTP layer. `server.ts` is the **composition root** where all dependencies are wired and adapter selection happens.
- **`src/adapters/output/`** — `dynamo/` (DynamoDB via AWS SDK v2), `repositories/` (InMemory for tests/local), `http/` (SpotifyApiAdapter).

**Path aliases** (`@domain/*`, `@ports/*`, `@application/*`, `@adapters/*`) are configured in both `tsconfig.json` and `jest.config.ts`.

## Key design details

**Adapter selection at startup:** `server.ts` checks for `DYNAMO_ENDPOINT` or `AWS_ACCESS_KEY_ID` env vars and wires `Dynamo*Repository` adapters; falls back to `InMemory*Repository` when neither is present. Unit and integration tests run without Docker.

**DynamoDB single-table design:** All entities share one table (`focus-reading`). Key prefixes: `USER#<id>`, `BOOK#<id>`, `SESSION#<id>` with `#METADATA` sort keys. Chapters are separate items under `BOOK#<id>` / `CHAPTER#<nnn>`. All key construction is centralised in `src/adapters/output/dynamo/DynamoKeys.ts` — never inline key strings elsewhere. Full schema and access patterns in `infra/dynamo/TABLE_DESIGN.md`.

**Architecture tests** (`tests/architecture/hexagonal.test.ts`) parse raw import statements from every `.ts` file at runtime and fail the build if any inner layer imports from an outer one. They also assert the `domain` layer contains no framework package imports.

**Integration tests** (`tests/integration/api.test.ts`) use a `StubSpotifyService` implementing `SpotifyServicePort` — no real Spotify calls. HTTP testing uses Fastify's `app.inject()`, not a live server.

**Coverage thresholds** (configured in `jest.config.ts`): branches 20%, functions/lines/statements 20%. `src/adapters/input/rest/server.ts` is excluded from collection.

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Yes (prod) | Spotify API client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes (prod) | Spotify API client secret |
| `DYNAMO_ENDPOINT` | Optional | LocalStack endpoint (e.g. `http://localhost:4566`) — triggers DynamoDB adapters |
| `DYNAMO_TABLE_NAME` | Optional | Table name (default `focus-reading`) |
| `PORT` | Optional | HTTP port (default `3000`) |
| `LOG_LEVEL` | Optional | Pino log level (default `info`) |
