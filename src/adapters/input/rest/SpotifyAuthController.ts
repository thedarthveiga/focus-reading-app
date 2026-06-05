import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  DomainError,
  EntityNotFoundError,
  ExternalServiceError,
} from "../../../domain/errors/DomainError";
import { SpotifyAuthUseCase } from "../../../ports/driving/SpotifyAuthUseCase";
import { logger } from "../../../shared/logger";

const ExchangeSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});
const RefreshSchema = z.object({
  userId: z.string().min(1),
  refreshToken: z.string().min(1),
});

function handleError(
  err: unknown,
  reply: FastifyReply,
  correlationId: string,
): FastifyReply {
  void reply.header("X-Correlation-Id", correlationId);
  if (err instanceof EntityNotFoundError) {
    return reply
      .status(404)
      .send({ error: err.message, code: err.code, correlationId });
  }
  if (err instanceof ExternalServiceError) {
    return reply.status(502).send({
      error: "External service unavailable",
      code: err.code,
      correlationId,
    });
  }
  if (err instanceof DomainError) {
    return reply
      .status(422)
      .send({ error: err.message, code: err.code, correlationId });
  }
  logger.error(
    {
      correlationId,
      error: (err as Error).message,
      stack: (err as Error).stack,
      code: "UNKNOWN",
    },
    "SpotifyAuthController - unhandled error",
  );
  return reply.status(500).send({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    correlationId,
  });
}

export function registerSpotifyAuthRoutes(
  app: FastifyInstance,
  spotifyAuthUseCase: SpotifyAuthUseCase,
): void {
  app.get(
    "/auth/spotify/authorize",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const correlationId = req.headers["x-correlation-id"] as
        | string
        | undefined;
      if (!correlationId) {
        return reply.status(400).send({
          error: "Missing required header: X-Correlation-Id",
          code: "MISSING_CORRELATION_ID",
        });
      }

      const { userId } = req.query as { userId?: string };
      if (!userId) {
        void reply.header("X-Correlation-Id", correlationId);
        return reply.status(400).send({
          error: "Missing required query param: userId",
          code: "MISSING_PARAM",
          correlationId,
        });
      }

      logger.info(
        { correlationId },
        "SpotifyAuthController.authorize - request received",
      );
      const result = spotifyAuthUseCase.getAuthorizationUrl({
        userId,
        correlationId,
      });
      void reply.header("X-Correlation-Id", correlationId);
      logger.info(
        { correlationId },
        "SpotifyAuthController.authorize - request completed",
      );
      return reply.status(200).send(result);
    },
  );

  app.get(
    "/auth/spotify/callback",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const correlationId = req.headers["x-correlation-id"] as
        | string
        | undefined;
      if (!correlationId) {
        return reply.status(400).send({
          error: "Missing required header: X-Correlation-Id",
          code: "MISSING_CORRELATION_ID",
        });
      }

      const parsed = ExchangeSchema.safeParse(req.query);
      if (!parsed.success) {
        void reply.header("X-Correlation-Id", correlationId);
        return reply.status(400).send({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
          correlationId,
        });
      }

      logger.info(
        { correlationId },
        "SpotifyAuthController.callback - request received",
      );
      try {
        const result = await spotifyAuthUseCase.exchangeCode({
          ...parsed.data,
          correlationId,
        });
        void reply.header("X-Correlation-Id", correlationId);
        logger.info(
          { correlationId },
          "SpotifyAuthController.callback - request completed",
        );
        return reply.status(200).send(result);
      } catch (err) {
        return handleError(err, reply, correlationId);
      }
    },
  );

  app.post(
    "/auth/spotify/refresh",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const correlationId = req.headers["x-correlation-id"] as
        | string
        | undefined;
      if (!correlationId) {
        return reply.status(400).send({
          error: "Missing required header: X-Correlation-Id",
          code: "MISSING_CORRELATION_ID",
        });
      }

      const parsed = RefreshSchema.safeParse(req.body);
      if (!parsed.success) {
        void reply.header("X-Correlation-Id", correlationId);
        return reply.status(400).send({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
          correlationId,
        });
      }

      logger.info(
        { correlationId },
        "SpotifyAuthController.refresh - request received",
      );
      try {
        const result = await spotifyAuthUseCase.refreshToken({
          ...parsed.data,
          correlationId,
        });
        void reply.header("X-Correlation-Id", correlationId);
        logger.info(
          { correlationId },
          "SpotifyAuthController.refresh - request completed",
        );
        return reply.status(200).send(result);
      } catch (err) {
        return handleError(err, reply, correlationId);
      }
    },
  );
}
