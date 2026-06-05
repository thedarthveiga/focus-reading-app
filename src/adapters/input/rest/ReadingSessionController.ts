import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";

import {
  DomainError,
  EntityNotFoundError,
  ExternalServiceError,
} from "../../../domain/errors/DomainError";
import { CalibrateWpmUseCase } from "../../../ports/driving/CalibrateWpmUseCase";
import { GetSessionUseCase } from "../../../ports/driving/GetSessionUseCase";
import { PrepareReadingSessionUseCase } from "../../../ports/driving/PrepareReadingSessionUseCase";
import {
  SessionAction,
  SessionStateUseCase,
} from "../../../ports/driving/SessionStateUseCase";
import { logger } from "../../../shared/logger";

const PrepareSchema = z.object({
  userId: z.string().min(1),
  bookTitle: z.string().min(1),
  chapterNumber: z.number().int().positive(),
  chapterTitle: z.string().optional(),
  mode: z.enum(["focus", "immersion"]),
});

const CalibrateSchema = z.object({
  userId: z.string().min(1),
  wordsRead: z.number().int().positive(),
  elapsedSeconds: z.number().positive(),
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
    "ReadingSessionController.handleError - error occurred",
  );
  return reply.status(500).send({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
    correlationId,
  });
}

export function registerReadingSessionRoutes(
  app: FastifyInstance,
  prepareUseCase: PrepareReadingSessionUseCase,
  calibrateUseCase: CalibrateWpmUseCase,
  sessionStateUseCase: SessionStateUseCase,
  getSessionUseCase: GetSessionUseCase,
): void {
  app.post(
    "/sessions/prepare",
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
      logger.info(
        { correlationId },
        "ReadingSessionController.prepareSession - request received",
      );

      const parsed = PrepareSchema.safeParse(req.body);
      if (!parsed.success) {
        void reply.header("X-Correlation-Id", correlationId);
        return reply.status(400).send({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
          correlationId,
        });
      }

      try {
        const result = await prepareUseCase.execute({
          ...parsed.data,
          correlationId,
        });
        void reply.header("X-Correlation-Id", correlationId);
        logger.info(
          { correlationId },
          "ReadingSessionController.prepareSession - request completed",
        );
        return reply.status(201).send(result);
      } catch (err) {
        return handleError(err, reply, correlationId);
      }
    },
  );

  app.post(
    "/sessions/calibrate",
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
      logger.info(
        { correlationId },
        "ReadingSessionController.calibrate - request received",
      );

      const parsed = CalibrateSchema.safeParse(req.body);
      if (!parsed.success) {
        void reply.header("X-Correlation-Id", correlationId);
        return reply.status(400).send({
          error: "Validation error",
          code: "VALIDATION_ERROR",
          details: parsed.error.flatten(),
          correlationId,
        });
      }

      try {
        const result = await calibrateUseCase.execute({
          ...parsed.data,
          correlationId,
        });
        void reply.header("X-Correlation-Id", correlationId);
        logger.info(
          { correlationId },
          "ReadingSessionController.calibrate - request completed",
        );
        return reply.status(200).send(result);
      } catch (err) {
        return handleError(err, reply, correlationId);
      }
    },
  );

  for (const action of [
    "pause",
    "resume",
    "complete",
    "interrupt",
  ] as SessionAction[]) {
    app.post(
      `/sessions/:id/${action}`,
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
        const { id: sessionId } = req.params as { id: string };
        logger.info(
          { correlationId, sessionId, action },
          `ReadingSessionController.${action} - request received`,
        );

        try {
          const result = await sessionStateUseCase.execute({
            sessionId,
            action,
            correlationId,
          });
          void reply.header("X-Correlation-Id", correlationId);
          logger.info(
            { correlationId, sessionId },
            `ReadingSessionController.${action} - request completed`,
          );
          return reply.status(200).send(result);
        } catch (err) {
          return handleError(err, reply, correlationId);
        }
      },
    );
  }

  app.get("/sessions/:id", async (req: FastifyRequest, reply: FastifyReply) => {
    const correlationId = req.headers["x-correlation-id"] as string | undefined;
    if (!correlationId) {
      return reply.status(400).send({
        error: "Missing required header: X-Correlation-Id",
        code: "MISSING_CORRELATION_ID",
      });
    }
    const { id: sessionId } = req.params as { id: string };
    logger.info(
      { correlationId, sessionId },
      "ReadingSessionController.getSession - request received",
    );

    try {
      const result = await getSessionUseCase.execute({
        sessionId,
        correlationId,
      });
      void reply.header("X-Correlation-Id", correlationId);
      logger.info(
        { correlationId, sessionId },
        "ReadingSessionController.getSession - request completed",
      );
      return reply.status(200).send(result);
    } catch (err) {
      return handleError(err, reply, correlationId);
    }
  });

  app.get("/health", async (_req, reply) => {
    return reply
      .status(200)
      .send({ status: "ok", timestamp: new Date().toISOString() });
  });
}
