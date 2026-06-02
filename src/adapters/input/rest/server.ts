import "dotenv/config";

import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import Fastify from "fastify";

import { CalibrateWpmInteractor } from "../../../application/use-cases/CalibrateWpmInteractor";
import { PrepareReadingSessionInteractor } from "../../../application/use-cases/PrepareReadingSessionInteractor";
import { BookRepositoryPort } from "../../../ports/driven/BookRepositoryPort";
import { UserRepositoryPort } from "../../../ports/driven/UserRepositoryPort";
import { DynamoBookRepository } from "../../output/dynamo/DynamoBookRepository";
import {
  createDynamoClient,
  loadDynamoConfig,
} from "../../output/dynamo/DynamoClient";
import { DynamoUserRepository } from "../../output/dynamo/DynamoUserRepository";
import { SpotifyApiAdapter } from "../../output/http/SpotifyApiAdapter";
import { InMemoryBookRepository } from "../../output/repositories/InMemoryBookRepository";
import { InMemoryUserRepository } from "../../output/repositories/InMemoryUserRepository";
import { UuidGenerator } from "../../output/repositories/UuidGenerator";

import { registerReadingSessionRoutes } from "./ReadingSessionController";

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

function buildRepositories(): {
  userRepo: UserRepositoryPort;
  bookRepo: BookRepositoryPort;
} {
  const dynamoConfig = loadDynamoConfig();

  // Use DynamoDB adapters when DYNAMO_ENDPOINT or AWS credentials are present,
  // fall back to InMemory for local unit test runs without Docker.
  if (process.env.DYNAMO_ENDPOINT || process.env.AWS_ACCESS_KEY_ID) {
    const dynamoClient = createDynamoClient(dynamoConfig);
    return {
      userRepo: new DynamoUserRepository(dynamoClient, dynamoConfig.tableName),
      bookRepo: new DynamoBookRepository(dynamoClient, dynamoConfig.tableName),
    };
  }

  return {
    userRepo: new InMemoryUserRepository(),
    bookRepo: new InMemoryBookRepository(),
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
  const { userRepo, bookRepo } = buildRepositories();

  const spotifyService = new SpotifyApiAdapter(
    process.env.SPOTIFY_CLIENT_ID ?? "",
    process.env.SPOTIFY_CLIENT_SECRET ?? "",
  );
  const idGenerator = new UuidGenerator();

  const prepareUseCase = new PrepareReadingSessionInteractor(
    userRepo,
    bookRepo,
    spotifyService,
    idGenerator,
  );
  const calibrateUseCase = new CalibrateWpmInteractor(userRepo);

  registerReadingSessionRoutes(app, prepareUseCase, calibrateUseCase);

  await app.listen({ port: PORT, host: HOST });
  app.log.info(
    `Server listening on ${HOST}:${PORT} [adapter: ${process.env.DYNAMO_ENDPOINT ? "DynamoDB" : "InMemory"}]`,
  );
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
