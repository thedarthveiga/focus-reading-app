# Focus Reading App — API

## O que é o produto

O Focus Reading App combina neurociência, inteligência artificial e música para criar sessões de leitura profundas e mensuráveis. O ritual completo funciona assim:

1. **Calibração de WPM** — o usuário lê um trecho de texto por um tempo medido e informa as palavras lidas. A API calcula o WPM real e persiste no perfil. Pode ser refeita a qualquer momento para recalibrar.
2. **Início de sessão** — o usuário escolhe o modo (`focus` para concentração profunda, `immersion` para leitura fluída), informa o título do livro e o número do capítulo.
3. **Estimativa de tempo** — a API usa o Claude para estimar o número de palavras do capítulo e aplica o WPM calibrado com buffer de 15% para calcular a duração real da sessão.
4. **Composição de playlist** — o Claude sugere músicas instrumentais adequadas ao modo e ao contexto do livro.
5. **Criação no Spotify** — a API busca cada faixa sugerida no Spotify e cria a playlist diretamente na conta do usuário.
6. **Controle da sessão** — o app mobile inicia a música, exibe o timer e bloqueia distrações. O backend expõe endpoints para pausar, retomar, completar ou interromper a sessão, registrando o tempo acumulado de pausa.

> **Escopo deste repositório:** apenas a API backend. O app mobile React Native (timer, bloqueio de distrações) vive em repositório separado. Um BFF será adicionado entre o mobile e esta API na v2.

---

## Arquitetura

Hexagonal estrita (Ports & Adapters). Regra de dependência: setas sempre apontam para dentro.

```
adapters → application → ports → domain
```

```
src/
├── domain/               ← Regras de negócio puras. Zero imports externos.
│   ├── entities/         ← Book, User, ReadingSession
│   ├── value-objects/    ← WpmSpeed, ReadingMode, GeneratedPlaylist, TrackSuggestion …
│   ├── services/         ← ReadingTimeCalculator (WPM + buffer de 15%)
│   └── errors/           ← DomainError, EntityNotFoundError, ExternalServiceError
├── ports/
│   ├── driving/          ← Interfaces dos use cases (PrepareReadingSession, CalibrateWpm …)
│   └── driven/           ← Contratos de repositórios e serviços externos
├── application/
│   └── use-cases/        ← Interactors orquestram domínio + ports sem conhecer adapters
├── adapters/
│   ├── input/rest/       ← ReadingSessionController, SpotifyAuthController (Fastify)
│   └── output/
│       ├── dynamo/       ← DynamoUserRepository, DynamoSessionRepository
│       ├── http/         ← SpotifyAdapter, ClaudePlaylistComposerAdapter,
│       │                    ClaudePlaylistComposerMockAdapter
│       └── repositories/ ← InMemoryUserRepository, InMemorySessionRepository
└── shared/
    └── logger.ts         ← Singleton Pino compartilhado entre application e adapters
```

**Seleção de adapter em tempo de execução (composition root em `server.ts`):**
- `DYNAMO_ENDPOINT` ou `AWS_ACCESS_KEY_ID` presentes → adapters DynamoDB; caso contrário → InMemory.
- `ANTHROPIC_API_KEY` presente → `ClaudePlaylistComposerAdapter`; caso contrário → `ClaudePlaylistComposerMockAdapter` (retorna playlist fixa, sem chamada à API).

---

## Fluxo completo — POST /sessions/prepare

Implementado em `PrepareReadingSessionInteractor.execute()`:

1. Busca o usuário pelo `userId` e verifica se possui token Spotify válido e não expirado.
2. Chama `ClaudePlaylistComposerAdapter.estimateWordCount` para estimar o número de palavras do capítulo informado.
3. Calcula a duração estimada: `wordCount / wpm * 1.15` (buffer de imersão), arredondado para cima em minutos.
4. Chama `ClaudePlaylistComposerAdapter.composePlaylist` com o livro, capítulo, modo e duração para obter nome da playlist e lista de faixas sugeridas.
5. Para cada faixa sugerida, chama `SpotifyAdapter.searchTrack` para obter o ID da faixa no Spotify.
6. Chama `SpotifyAdapter.createPlaylist` com o token de acesso do usuário para criar a playlist e adicionar as faixas encontradas.
7. Cria e persiste uma `ReadingSession` com status `pending`.
8. Retorna `sessionId`, `estimatedMinutes`, `spotifyPlaylistUrl` e `playlistName`.

---

## Correlation ID

Todo request (exceto `GET /health`) exige o header:

```
X-Correlation-Id: <uuid gerado pelo cliente>
```

- **Ausente** → `400 MISSING_CORRELATION_ID` imediatamente, antes de qualquer processamento.
- **Presente** → propagado por toda a cadeia: controller → use case → adapters externos. Cada log registra o `correlationId` como campo estruturado.
- **Resposta** → o mesmo ID é devolvido no header `X-Correlation-Id` de toda resposta (sucesso ou erro) e incluído no body de respostas de erro.

Isso permite rastrear qualquer request nos logs pelo ID que o cliente gerou.

---

## Endpoints

### Autenticação Spotify (OAuth2 PKCE)

| Método | Path | Header obrigatório | Descrição |
|--------|------|-------------------|-----------|
| `GET` | `/auth/spotify/authorize?userId=<id>` | `X-Correlation-Id` | Gera `authUrl` e `codeVerifier` para iniciar o fluxo PKCE |
| `GET` | `/auth/spotify/callback?code=<code>&state=<state>` | `X-Correlation-Id` | Troca o código por tokens e persiste no usuário |
| `POST` | `/auth/spotify/refresh` | `X-Correlation-Id` | Renova o access token usando o refresh token |

### Sessões de leitura

| Método | Path | Header obrigatório | Descrição |
|--------|------|-------------------|-----------|
| `POST` | `/sessions/prepare` | `X-Correlation-Id` | Estima duração, compõe e cria playlist no Spotify, cria sessão |
| `POST` | `/sessions/calibrate` | `X-Correlation-Id` | Calcula e persiste o WPM do usuário (calibração inicial ou recalibração) |
| `POST` | `/sessions/:id/pause` | `X-Correlation-Id` | Pausa a sessão, registra `pausedAt` |
| `POST` | `/sessions/:id/resume` | `X-Correlation-Id` | Retoma a sessão, acumula `totalPausedSeconds` |
| `POST` | `/sessions/:id/complete` | `X-Correlation-Id` | Marca a sessão como concluída |
| `POST` | `/sessions/:id/interrupt` | `X-Correlation-Id` | Marca a sessão como interrompida |
| `GET` | `/sessions/:id` | `X-Correlation-Id` | Retorna o estado atual da sessão |

### Infraestrutura

| Método | Path | Header obrigatório | Descrição |
|--------|------|-------------------|-----------|
| `GET` | `/health` | — | Health check (não exige `X-Correlation-Id`) |

### Respostas de erro

Todas as respostas de erro seguem o mesmo formato:

```json
{
  "error": "Mensagem legível para o usuário",
  "code": "CODIGO_MAQUINA",
  "correlationId": "o-mesmo-id-do-header-da-requisicao"
}
```

| Situação | HTTP | Código |
|---|---|---|
| Header `X-Correlation-Id` ausente | 400 | `MISSING_CORRELATION_ID` |
| Falha de validação do body | 400 | `VALIDATION_ERROR` |
| Entidade não encontrada | 404 | `ENTITY_NOT_FOUND` |
| Violação de regra de negócio | 422 | código específico do domínio |
| Falha no Spotify ou Claude API | 502 | `EXTERNAL_SERVICE_ERROR` |
| Erro inesperado | 500 | `INTERNAL_ERROR` (sem detalhes internos expostos) |

---

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `PORT` | Não | Porta HTTP (padrão `3000`) |
| `HOST` | Não | Host de escuta (padrão `0.0.0.0`) |
| `NODE_ENV` | Não | Ambiente (`development` / `production`) |
| `LOG_LEVEL` | Não | Nível Pino (padrão `info`) |
| `CORS_ORIGIN` | Não | Origem permitida no CORS (padrão `*`) |
| `DYNAMO_ENDPOINT` | Não | Endpoint do LocalStack — ativa adapters DynamoDB |
| `DYNAMO_TABLE_NAME` | Não | Nome da tabela (padrão `focus-reading`) |
| `AWS_REGION` | Não | Região AWS (padrão `us-east-1`) |
| `AWS_ACCESS_KEY_ID` | Não (prod via OIDC) | Chave de acesso AWS |
| `AWS_SECRET_ACCESS_KEY` | Não (prod via OIDC) | Chave secreta AWS |
| `SPOTIFY_CLIENT_ID` | Sim (prod) | Client ID da Spotify Web API |
| `SPOTIFY_CLIENT_SECRET` | Sim (prod) | Client Secret da Spotify Web API (usado para busca via client credentials) |
| `SPOTIFY_REDIRECT_URI` | Sim (prod) | URI de callback OAuth2 PKCE (ex: `https://api.example.com/auth/spotify/callback`) |
| `ANTHROPIC_API_KEY` | Não | Chave da Claude API — ausente ativa o mock de playlist automaticamente |

---

## Testes

```bash
npm run test:unit        # Domínio + use cases (sem I/O, ~40 testes)
npm run test:integration # Round-trips HTTP completos com adapters stub
npm run test:arch        # Verificação de fronteiras hexagonais
npm run test:coverage    # Todos os testes + relatório (≥20% — threshold MVP)
npm run validate         # typecheck + lint + format check (gate de pre-push)
```

Os testes de integração usam adapters stub — nenhuma chamada real ao Spotify ou ao Claude.

---

## DynamoDB local (opcional)

```bash
npm run docker:up    # Sobe LocalStack
npm run db:setup     # Cria tabela + seed
# Configure DYNAMO_ENDPOINT=http://localhost:4566 no .env
npm run start:dev
```

---

## CI/CD

| Workflow | Trigger | Propósito |
|---|---|---|
| `ci.yml` | push/PR em `develop`, `release/*`, `main` | typecheck, lint, testes, coverage, build, Docker |
| `branch-policy.yml` | todo PR | Valida nomenclatura GitFlow da branch de origem |
| `release.yml` | push de tag `v*` | CI completo + cria GitHub Release com changelog |
| `deploy.yml` | push de tag `v*` | Build Docker → push ECR → deploy ECS Fargate |
| `auto-pr.yml` | push em branches feature | Abre PR automaticamente após CI passar |
