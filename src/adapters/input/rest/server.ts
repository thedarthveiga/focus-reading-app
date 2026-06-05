import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { CalibrateWpmInteractor } from "../../../application/use-cases/CalibrateWpmInteractor";
import { GetSessionInteractor } from "../../../application/use-cases/GetSessionInteractor";
import { PrepareReadingSessionInteractor } from "../../../application/use-cases/PrepareReadingSessionInteractor";
import { SessionStateInteractor } from "../../../application/use-cases/SessionStateInteractor";
import { SpotifyAuthInteractor } from "../../../application/use-cases/SpotifyAuthInteractor";
import { SessionRepositoryPort } from "../../../ports/driven/SessionRepositoryPort";
import { UserRepositoryPort } from "../../../ports/driven/UserRepositoryPort";
import {
  createDynamoClient,
  loadDynamoConfig,
} from "../../output/dynamo/DynamoClient";
import { DynamoSessionRepository } from "../../output/dynamo/DynamoSessionRepository";
import { DynamoUserRepository } from "../../output/dynamo/DynamoUserRepository";
import { ClaudePlaylistComposerAdapter } from "../../output/http/ClaudePlaylistComposerAdapter";
import { ClaudePlaylistComposerMockAdapter } from "../../output/http/ClaudePlaylistComposerMockAdapter";
import { SpotifyAdapter } from "../../output/http/SpotifyAdapter";
import { InMemorySessionRepository } from "../../output/repositories/InMemorySessionRepository";
import { InMemoryUserRepository } from "../../output/repositories/InMemoryUserRepository";
import { UuidGenerator } from "../../output/repositories/UuidGenerator";

import { registerReadingSessionRoutes } from "./ReadingSessionController";
import { registerSpotifyAuthRoutes } from "./SpotifyAuthController";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function buildRepositories(): {
  userRepo: UserRepositoryPort;
  sessionRepo: SessionRepositoryPort;
} {
  const dynamoConfig = loadDynamoConfig();
  if (process.env.DYNAMO_ENDPOINT || process.env.AWS_ACCESS_KEY_ID) {
    const client = createDynamoClient(dynamoConfig);
    return {
      userRepo: new DynamoUserRepository(client, dynamoConfig.tableName),
      sessionRepo: new DynamoSessionRepository(client, dynamoConfig.tableName),
    };
  }
  return {
    userRepo: new InMemoryUserRepository(),
    sessionRepo: new InMemorySessionRepository(),
  };
}

async function bootstrap(): Promise<void> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      transport:
        process.env.NODE_ENV !== "production"
          ? { target: "pino-pretty" }
          : undefined,
    },
  });

  await app.register(cors, { origin: process.env.CORS_ORIGIN ?? "*" });
  await app.register(helmet);

  // ── Composition Root ─────────────────────────────────────────────────────
  const { userRepo, sessionRepo } = buildRepositories();

  const aiComposer = process.env.ANTHROPIC_API_KEY
    ? new ClaudePlaylistComposerAdapter(process.env.ANTHROPIC_API_KEY)
    : new ClaudePlaylistComposerMockAdapter();

  const spotifyAdapter = new SpotifyAdapter(
    process.env.SPOTIFY_CLIENT_ID ?? "",
    process.env.SPOTIFY_CLIENT_SECRET ?? "",
    process.env.SPOTIFY_REDIRECT_URI ??
      "http://localhost:3000/auth/spotify/callback",
  );

  const idGenerator = new UuidGenerator();

  const prepareUseCase = new PrepareReadingSessionInteractor(
    userRepo,
    sessionRepo,
    aiComposer,
    spotifyAdapter,
    idGenerator,
  );
  const calibrateUseCase = new CalibrateWpmInteractor(userRepo);
  const sessionStateUseCase = new SessionStateInteractor(sessionRepo);
  const getSessionUseCase = new GetSessionInteractor(sessionRepo);
  const spotifyAuthUseCase = new SpotifyAuthInteractor(
    spotifyAdapter,
    userRepo,
  );

  registerReadingSessionRoutes(
    app,
    prepareUseCase,
    calibrateUseCase,
    sessionStateUseCase,
    getSessionUseCase,
  );
  registerSpotifyAuthRoutes(app, spotifyAuthUseCase);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(
    `Server listening on ${HOST}:${PORT} [adapter: ${process.env.DYNAMO_ENDPOINT ? "DynamoDB" : "InMemory"}] [ai: ${process.env.ANTHROPIC_API_KEY ? "Claude" : "Mock"}]`,
  );
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
