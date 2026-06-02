import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { DomainError, EntityNotFoundError } from '../../../domain/errors/DomainError';
import { CalibrateWpmUseCase } from '../../../ports/driving/CalibrateWpmUseCase';
import { PrepareReadingSessionUseCase } from '../../../ports/driving/PrepareReadingSessionUseCase';

const PrepareSessionSchema = z.object({
  userId: z.string().min(1),
  bookId: z.string().min(1),
  chapterNumber: z.number().int().positive(),
});

const CalibrateWpmSchema = z.object({
  userId: z.string().min(1),
  wordsRead: z.number().int().positive(),
  elapsedSeconds: z.number().positive(),
});

export function registerReadingSessionRoutes(
  app: FastifyInstance,
  prepareUseCase: PrepareReadingSessionUseCase,
  calibrateUseCase: CalibrateWpmUseCase,
): void {
  app.post('/sessions/prepare', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = PrepareSessionSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const result = await prepareUseCase.execute(parsed.data);
      return reply.status(201).send(result);
    } catch (err) {
      return handleDomainError(err, reply);
    }
  });

  app.post('/sessions/calibrate', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = CalibrateWpmSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parsed.error.flatten() });
    }

    try {
      const wpm = await calibrateUseCase.execute(parsed.data);
      return reply.status(200).send({ wpm: wpm.value, calibratedAt: wpm.calibratedAt });
    } catch (err) {
      return handleDomainError(err, reply);
    }
  });

  app.get('/health', async (_req, reply) => {
    return reply.status(200).send({ status: 'ok', timestamp: new Date().toISOString() });
  });
}

function handleDomainError(err: unknown, reply: FastifyReply): FastifyReply {
  if (err instanceof EntityNotFoundError) {
    return reply.status(404).send({ error: err.message, code: err.code });
  }
  if (err instanceof DomainError) {
    return reply.status(422).send({ error: err.message, code: err.code });
  }
  throw err; // let Fastify handle unexpected errors
}
