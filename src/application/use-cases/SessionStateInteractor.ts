import { ReadingSession } from "../../domain/entities/ReadingSession";
import { SessionRepositoryPort } from "../../ports/driven/SessionRepositoryPort";
import {
  SessionAction,
  SessionStateInput,
  SessionStateOutput,
  SessionStateUseCase,
} from "../../ports/driving/SessionStateUseCase";
import { logger } from "../../shared/logger";

export class SessionStateInteractor implements SessionStateUseCase {
  constructor(private readonly sessionRepo: SessionRepositoryPort) {}

  async execute(input: SessionStateInput): Promise<SessionStateOutput> {
    const { correlationId, sessionId, action } = input;
    logger.info(
      { correlationId, sessionId, action },
      "SessionStateInteractor.execute - started",
    );

    try {
      const session = await this.sessionRepo.findById(sessionId);
      const updated = this.applyAction(session, action);
      await this.sessionRepo.save(updated);

      logger.info(
        { correlationId, sessionId, status: updated.status },
        "SessionStateInteractor.execute - completed",
      );
      return { sessionId: updated.id, status: updated.status };
    } catch (err) {
      logger.error(
        {
          correlationId,
          error: (err as Error).message,
          stack: (err as Error).stack,
          code: (err as { code?: string }).code ?? "UNKNOWN",
        },
        "SessionStateInteractor.execute - error occurred",
      );
      throw err;
    }
  }

  private applyAction(
    session: ReadingSession,
    action: SessionAction,
  ): ReadingSession {
    switch (action) {
      case "pause":
        return session.pause();
      case "resume":
        return session.resume();
      case "complete":
        return session.complete();
      case "interrupt":
        return session.interrupt();
    }
  }
}
